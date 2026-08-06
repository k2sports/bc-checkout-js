/* eslint-disable prettier/prettier */
import {
  type Cart,
  type Checkout,
  type Fee,
  type LineItem,
  type Order,
} from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';

import { type CartMetafield, type LoopQuote } from './types';

export const LOOP_NAMESPACE = 'loop_checkout_plus';

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

function shouldRemoveLoopFee(
  loopQuoteData: LoopQuote | null,
  appliedLoopOrderFee: Fee | undefined,
  loopCartMetadata: CartMetafield | null,
): boolean {
  if (!appliedLoopOrderFee && !loopCartMetadata?.value) {
    return false; // Nothing to remove
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

async function setLoopOrderMetadata(order: Order): Promise<void> {
  // Get order fees
  const loopFee = order?.fees?.find((fee) => fee.source === 'loop');

  if (!loopFee) {
    return;
  }

  // Get cart metadata
  const cartMetadataResp = await requestSender.post(
    `/checkout/bigcommerce/cart-metadata/${order.cartId}/${LOOP_NAMESPACE}`,
  );

  const loopCartMetadata = cartMetadataResp?.body as CartMetafield;

  if (!loopCartMetadata?.id || !loopCartMetadata?.value) {
    return;
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
    });
}

async function removeLoopOrderFees(
  checkoutId: string,
  loopOrderFee: Fee | null,
  cartMetafieldId: string | null,
) {
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

  if (!promises?.length) {
    console.log('removeLoopOrderFees: nothing to remove');

    return;
  }

  await Promise.all(promises)
    .then((results) => {
      console.log('removeLoopOrderFees results:', results);
    })
    .catch((error) => {
      console.error('removeLoopOrderFees errors:', error);
    });
}

export {
  setLoopOrderMetadata,
  removeLoopOrderFees,
  centsToDollars,
  dollarsToCents,
  getLoopQuote,
  shouldRemoveLoopFee,
  getCartMetadataAmount,
};
