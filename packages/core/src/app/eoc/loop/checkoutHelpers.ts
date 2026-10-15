/* eslint-disable no-console */
/* eslint-disable prettier/prettier */
// EOC Helpers
import {
  type Cart,
  type Checkout,
  type Fee,
  type LineItem,
  type LineItemMap,
  type Order,
} from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';

import {
  type CartMetafield,
  FEE_DISPLAY_NAME,
  HELPER_URL,
  LOOP_EMPTY_VALUE,
  LOOP_NAMESPACE,
  type LoopQuote,
} from './types';

interface CheckoutResponse {
  error: boolean;
  message?: string;
}

const requestSender = createRequestSender({
  host: HELPER_URL,
});

function dollarsToCents(amount: number) {
  return Math.round(amount * 100);
}

function centsToDollars(amount: number) {
  return amount / 100;
}

function getCartMetadataAmount(loopCartMetadata: CartMetafield | null): number | null {
  if (
    !loopCartMetadata ||
    !loopCartMetadata?.value ||
    loopCartMetadata?.value === LOOP_EMPTY_VALUE
  ) {
    return null;
  }

  const cartMetadataObject = JSON.parse(loopCartMetadata?.value || '');

  return cartMetadataObject?.fee_amount || null;
}

function getReturnsCartItem(cartItems: LineItemMap | undefined, sku: string): string | null {
  if (!cartItems || !cartItems?.customItems?.length) {
    return null;
  }

  const returnsItem = cartItems.customItems?.find((item) => item.sku === sku);

  return returnsItem?.id || null;
}

function shouldRemoveLoopFee(
  loopQuoteData: LoopQuote | null,
  appliedLoopOrderFee: Fee | null,
  loopCartMetadata: CartMetafield | null,
  cartItems: LineItemMap,
  ghostSku: string,
): boolean {
  const returnsItemId = getReturnsCartItem(cartItems, ghostSku);

  if (
    !appliedLoopOrderFee &&
    (!loopCartMetadata?.value || loopCartMetadata?.value === LOOP_EMPTY_VALUE) &&
    !returnsItemId
  ) {
    return false; // Nothing to remove
  }

  // IF only the ghost product exists
  if (
    !appliedLoopOrderFee &&
    (!loopCartMetadata?.value || loopCartMetadata?.value === LOOP_EMPTY_VALUE) &&
    returnsItemId
  ) {
    return true;
  }

  // Remove order fee and cart metadata:
  // IF no loop quote or order isn't eligible for Loop
  if (!loopQuoteData || !loopQuoteData?.eligible) {
    return true;
  }

  // IF quote changed from applied fee
  if (
    appliedLoopOrderFee &&
    dollarsToCents(appliedLoopOrderFee?.cost) !== loopQuoteData?.chargeInstructions?.amount
  ) {
    return true;
  }

  // IF fee but no cart metadata
  if (
    appliedLoopOrderFee &&
    (!loopCartMetadata?.value || loopCartMetadata?.value === LOOP_EMPTY_VALUE)
  ) {
    return true;
  }

  const cartMetadataObject = JSON.parse(loopCartMetadata?.value || '');
  const cartMetadataAmount = cartMetadataObject?.fee_amount || 0;

  // IF fee does not match cart metadata
  if (appliedLoopOrderFee && appliedLoopOrderFee?.cost !== centsToDollars(cartMetadataAmount)) {
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
      console.log('Loop Order Metadata Set Successfully:', results);
    })
    .catch((error) => {
      console.error('Error Setting Loop Order Metadata:', error);
      hasError = true;
    });

  return {
    error: hasError,
    message: 'An error occured when setting the order metadata for Loop fees',
  };
}

async function applyLoopOrderFees(
  checkoutId: string,
  loopQuote: LoopQuote,
  loopOrderFee: Fee | null,
  cartItems: LineItemMap,
  enableGhostProduct: boolean,
  ghostSku: string,
  taxId: number | undefined,
) {
  const removalPromises: any[] = [];

  // add fee
  await requestSender
    .post('/checkout/bigcommerce/update-order-fees', {
      body: {
        checkoutId,
        fee: {
          id: loopOrderFee?.id,
          type: 'custom_fee',
          name: LOOP_NAMESPACE,
          display_name: FEE_DISPLAY_NAME,
          cost: centsToDollars(loopQuote.chargeInstructions.amount), // convert cents to dollars
          source: 'loop',
          tax_class_id: taxId,
        },
      },
    })
    .then((results: any) => {
      const orderFees: Fee[] = results?.body?.data?.fees || [];
      const feeIds: string[] = orderFees
        ?.filter((fee) => fee.name === LOOP_NAMESPACE)
        .map((fee: Fee) => fee.id);

      if (feeIds.length > 1) {
        // Keep first fee and remove all others
        feeIds.shift();
        feeIds.forEach((id) => {
          removalPromises.push(
            requestSender.delete('/checkout/bigcommerce/delete-order-fees', {
              body: {
                checkoutId,
                fee: {
                  id,
                },
              },
            }),
          );
        });
      }
    })
    .catch((error) => {
      console.error('add loop fee errors:', error);
    });

  // Add ghost item for netsuite support, verify it doesn't exist first
  const returnsItemId = getReturnsCartItem(cartItems, ghostSku);

  if (enableGhostProduct && !returnsItemId) {
    await requestSender
      .post('/checkout/bigcommerce/cart-items', {
        body: {
          checkoutId,
          items: {
            custom_items: [
              {
                sku: ghostSku,
                name: FEE_DISPLAY_NAME,
                list_price: 0,
                quantity: 1,
                image_url: 'https://k2sports.a.bigcontent.io/v1/static/returns-icon',
              },
            ],
          },
        },
      })
      .catch((error) => {
        console.error('add loop ghost product errors:', error);
      });
  }

  // delete duplicate fees and ghost products
  if (removalPromises?.length) {
    await Promise.all(removalPromises).catch((error) => {
      console.error('removalPromises errors:', error);
    });
  }
}

async function removeLoopOrderFees(
  checkoutId: string,
  loopOrderFee: Fee | null,
  cartMetafieldId: string | null,
  cartItems: LineItemMap,
  ghostSku: string,
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
      requestSender.post('/checkout/bigcommerce/cart-metadata', {
        body: {
          checkoutId,
          metafield: {
            id: cartMetafieldId,
            permission_set: 'write_and_sf_access',
            namespace: LOOP_NAMESPACE,
            key: LOOP_NAMESPACE,
            value: 'declined',
          },
        },
      }),
    );
  }

  const returnsItemId = getReturnsCartItem(cartItems, ghostSku);

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
    return {
      error: hasError,
    };
  }

  await Promise.all(promises).catch((error) => {
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
  applyLoopOrderFees,
};
