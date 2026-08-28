/* eslint-disable prettier/prettier */
import {
  type Cart,
  type Checkout,
  type Fee,
  type LineItem,
  type LineItemMap,
  type Order,
} from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';

import { type CartMetafield, type LoopQuote } from './types';

export const LOOP_NAMESPACE = 'loop_checkout_plus';
export const RETURNS_ITEM_SKU = 'returns-coverage';
export const FEE_DISPLAY_NAME = 'Checkout+ Returns Coverage';

interface CheckoutResponse {
  error: boolean;
  message?: string;
}

const requestSender = createRequestSender({
  //   host: 'https://subconsciously-pointless-jeanne.ngrok-free.dev/api/v1/',
  host: 'https://dev-eoc-checkout-helper.onrender.com/api/v1/',
});

function dollarsToCents(amount: number) {
  return amount * 100;
}

function centsToDollars(amount: number) {
  return amount / 100;
}

function getCartMetadataAmount(loopCartMetadata: CartMetafield | null): number | null {
  if (!loopCartMetadata || !loopCartMetadata?.value) {
    return null;
  }

  const cartMetadataObject = JSON.parse(loopCartMetadata?.value || '');

  return cartMetadataObject?.fee_amount || null;
}

function getReturnsCartItem(cartItems: LineItemMap | undefined): string | null {
  if (!cartItems || !cartItems?.customItems?.length) {
    return null;
  }

  const returnsItem = cartItems.customItems?.find((item) => item.sku === RETURNS_ITEM_SKU);

  return returnsItem?.id || null;
}

function shouldRemoveLoopFee(
  loopQuoteData: LoopQuote | null,
  appliedLoopOrderFee: Fee | undefined,
  loopCartMetadata: CartMetafield | null,
  cartItems: LineItemMap,
): boolean {
  const returnsItemId = getReturnsCartItem(cartItems);

  if (!appliedLoopOrderFee && !loopCartMetadata?.value && !returnsItemId) {
    return false; // Nothing to remove
  }

  if (!appliedLoopOrderFee && !loopCartMetadata?.value && returnsItemId) {
    console.log('REMOVE returns item');

    return true;
  }

  // Remove order fee and cart metadata:
  // IF no loop quote or order isn't eligible for Loop
  if (!loopQuoteData || !loopQuoteData?.eligible) {
    console.log('REMOVE quote does not exist or is not eligible', loopQuoteData);

    return true;
  }

  // IF quote changed from applied fee
  if (
    appliedLoopOrderFee &&
    dollarsToCents(appliedLoopOrderFee?.cost) !== loopQuoteData?.chargeInstructions?.amount
  ) {
    console.log(
      'REMOVE quote does not match applied fee',
      loopQuoteData?.chargeInstructions?.amount,
      appliedLoopOrderFee?.cost,
    );

    return true;
  }

  // IF fee but no cart metadata
  if (appliedLoopOrderFee && !loopCartMetadata?.value) {
    console.log(
      'REMOVE fee is applied but cart metadata is missing',
      appliedLoopOrderFee,
      loopCartMetadata,
    );

    return true;
  }

  const cartMetadataObject = JSON.parse(loopCartMetadata?.value || '');
  const cartMetadataAmount = cartMetadataObject?.fee_amount || 0;

  // IF fee does not match cart metadata
  if (appliedLoopOrderFee && appliedLoopOrderFee?.cost !== centsToDollars(cartMetadataAmount)) {
    console.log(
      'REMOVE fee does not match cart metadata amount',
      appliedLoopOrderFee,
      cartMetadataAmount,
    );

    return true;
  }

  // IF cart meta data amount does not match loop quote
  if (cartMetadataAmount !== loopQuoteData?.chargeInstructions?.amount) {
    return true;
  }

  return false;
}

async function getLoopQuote(cart: Cart, checkout: Checkout): Promise<LoopQuote | null> {
  const currencyCode = cart?.currency.code;
  // const allItems = Object.values(cart?.lineItems || {}).flat();
  const allItems = cart?.lineItems?.physicalItems || [];
  const cartItems = allItems?.map((item: LineItem) => ({
    id: item.id,
    productId: String(item.productId),
    quantity: item.quantity,
    unitPrice: {
      amount: dollarsToCents(item.listPrice),
      currencyCode,
    },
    totalPrice: {
      amount: dollarsToCents(item.extendedSalePrice),
      currencyCode,
    },
    originalTotalPrice: {
      amount: dollarsToCents(item.extendedListPrice),
      currencyCode,
    },
    title: item.name,
  }));

  const reqBody = {
    platform: 'bigcommerce',
    region: 'US',
    cartId: cart?.id,
    cart: {
      lines: cartItems,
      itemCount: cartItems?.length ? cartItems.reduce((acc, item) => acc + item.quantity, 0) : 0,
      subtotalAmount: dollarsToCents(checkout?.subtotal || 0),
      totalDiscountAmount: dollarsToCents(checkout?.totalDiscount || 0),
      discountedSubtotalAmount: dollarsToCents(checkout?.subtotal || 0),
      totalTaxAmount: dollarsToCents(checkout?.taxTotal || 0),
      totalAmount: dollarsToCents(checkout?.grandTotal || 0),
      currencyCode,
    },
  };

  // Get loop coverage options based on cart
  const loopQuoteResp = await requestSender.post('/checkout/loop/analyze', {
    body: reqBody,
  });
  // const loopQuoteData = loopQuoteResp.body as LoopQuote;

  return loopQuoteResp?.body ? (loopQuoteResp.body as LoopQuote) : null;
}

async function setLoopOrderMetadata(order: Order): Promise<CheckoutResponse> {
  let hasError = false;
  // Get order fees
  const loopFee = order?.fees?.find((fee) => fee.source === 'loop');

  if (!loopFee) {
    return {
      error: hasError,
    };
  }

  // Get cart metadata
  const cartMetadataResp = await requestSender.post(
    `/checkout/bigcommerce/cart-metadata/${order.cartId}/${LOOP_NAMESPACE}`,
  );

  const loopCartMetadata = cartMetadataResp?.body as CartMetafield;

  if (!loopCartMetadata?.id || !loopCartMetadata?.value) {
    return {
      error: hasError,
    };
  }

  // Set order metafields based on cart fields
  const loopData = JSON.parse(loopCartMetadata.value);
  const metafieldKeys = Object.keys(loopData);

  // only do this if the metadata isnt set
  await Promise.all(
    metafieldKeys.map((key) => {
      return requestSender.post('/checkout/bigcommerce/order-metadata', {
        body: {
          orderId: order.orderId,
          metafield: {
            namespace: LOOP_NAMESPACE,
            key,
            value:
              key === 'accepted_offer_mode' ? JSON.stringify(loopData[key]) : String(loopData[key]),
            permission_set: 'read_and_sf_access',
          },
        },
      });
    }),
  )
    .then((results) => {
      console.log('setLoopOrderMetadata results:', results);
    })
    .catch((error) => {
      console.error('setLoopOrderMetadata errors:', error);
      hasError = true;
    });

  return {
    error: hasError,
    message: 'An error occured when setting the order metadata for Loop fees',
  };
}

async function removeLoopOrderFees(
  checkoutId: string,
  loopOrderFee: Fee | null,
  cartMetafieldId: string | null,
  cartItems: LineItemMap,
  cartVersion?: number,
): Promise<CheckoutResponse> {
  let hasError = false;
  const promises = [];

  if (loopOrderFee) {
    promises.push(
      requestSender.delete('/checkout/bigcommerce/delete-order-fees', {
        body: {
          checkoutId,
          fee: {
            id: loopOrderFee?.id,
          },
        },
      }),
    );
  }

  if (cartMetafieldId) {
    promises.push(
      requestSender.delete('/checkout/bigcommerce/delete-cart-metadata', {
        body: {
          checkoutId,
          metafield: {
            id: cartMetafieldId,
          },
        },
      }),
    );
  }

  const returnsItemId = getReturnsCartItem(cartItems);

  console.log('cartItems', cartItems, 'returnsItemId', returnsItemId);

  if (returnsItemId) {
    promises.push(
      requestSender.delete(`/checkout/bigcommerce/cart-items/${returnsItemId}`, {
        body: {
          checkoutId,
          version: cartVersion,
        },
      }),
    );
  }

  if (!promises?.length) {
    console.log('removeLoopOrderFees: nothing to remove');

    return {
      error: hasError,
    };
  }

  await Promise.all(promises)
    .then((results) => {
      console.log('removeLoopOrderFees results:', results);
    })
    .catch((error) => {
      console.error('removeLoopOrderFees errors:', error);
      hasError = true;
    });

  return {
    error: hasError,
    message: 'An error occured when removing Loop fees from the order',
  };
}

export {
  setLoopOrderMetadata,
  removeLoopOrderFees,
  centsToDollars,
  dollarsToCents,
  getLoopQuote,
  shouldRemoveLoopFee,
  getCartMetadataAmount,
  getReturnsCartItem,
};
