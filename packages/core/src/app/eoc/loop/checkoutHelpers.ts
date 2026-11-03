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
  type CartMetadataResp,
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
  console.log('shouldRemoveLoopFee?', { loopQuoteData, loopCartMetadata });

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
    console.log('only the ghost product exists');

    return true;
  }

  // Remove order fee and cart metadata:
  // IF no loop quote or order isn't eligible for Loop
  if (!loopQuoteData || !loopQuoteData?.eligible) {
    console.log('no loop quote or order isnt eligible for Loop');

    return true;
  }

  // IF quote changed from applied fee
  if (
    appliedLoopOrderFee &&
    dollarsToCents(appliedLoopOrderFee?.cost) !== loopQuoteData?.chargeInstructions?.amount
  ) {
    console.log('quote changed from applied fee, but we dont care anymore');

    // return true;
  }

  // IF fee but no cart metadata
  if (
    appliedLoopOrderFee &&
    (!loopCartMetadata?.value || loopCartMetadata?.value === LOOP_EMPTY_VALUE)
  ) {
    console.log('fee but no cart metadata');

    return true;
  }

  const cartMetadataObject = JSON.parse(loopCartMetadata?.value || '');
  const cartMetadataAmount = cartMetadataObject?.fee_amount || 0;

  // IF fee does not match cart metadata
  if (appliedLoopOrderFee && appliedLoopOrderFee?.cost !== centsToDollars(cartMetadataAmount)) {
    console.log('fee does not match cart metadata, but we dont care anymore');
    // return true;
  }

  // IF cart meta data amount does not match loop quote
  if (cartMetadataAmount !== loopQuoteData?.chargeInstructions?.amount) {
    console.log('cart meta data amount does not match loop quote, but we dont care anymore');
    //   return true;
  }

  return false;
}

function shouldUpdateLoopFee(
  loopQuoteData: LoopQuote | null,
  appliedLoopOrderFee: Fee | null,
  loopCartMetadata: CartMetafield | null,
): boolean {
  console.log('shouldUpdateLoopFee?', {
    loopQuoteData,
    loopCartMetadata,
    appliedLoopOrderFee,
  });

  // IF declined
  if (loopCartMetadata?.value === LOOP_EMPTY_VALUE) {
    console.log('loop declined, dont update');

    return false;
  }

  // IF quote changed from applied fee
  if (
    appliedLoopOrderFee &&
    dollarsToCents(appliedLoopOrderFee?.cost) !== loopQuoteData?.chargeInstructions?.amount
  ) {
    console.log('quote changed from applied fee, lets update');

    return true;
  }

  // const cartMetadataObject = JSON.parse(loopCartMetadata?.value || '');
  // const cartMetadataAmount = cartMetadataObject?.fee_amount || 0;

  // IF fee does not match cart metadata
  // if (appliedLoopOrderFee && appliedLoopOrderFee?.cost !== centsToDollars(cartMetadataAmount)) {
  //   console.log('fee does not match cart metadata, lets update');

  //   return true;
  // }

  // // IF cart meta data amount does not match loop quote
  // if (cartMetadataAmount !== loopQuoteData?.chargeInstructions?.amount) {
  //   console.log('cart meta data amount does not match loop quote, but we dont care anymore');
  //   //   return true;
  // }
  console.log('do not need to update loop');

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
  cartMetafieldId: string | null,
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

  // Add/update loop data in cart metadata for future access
  let returnCartMetafieldId = null;

  // if (!cartMetafieldId) {
  const cartMetadataResp: CartMetadataResp = await requestSender.post(
    '/checkout/bigcommerce/cart-metadata',
    {
      body: {
        checkoutId,
        metafield: {
          id: cartMetafieldId,
          permission_set: 'write_and_sf_access',
          namespace: LOOP_NAMESPACE,
          key: LOOP_NAMESPACE,
          value: JSON.stringify({
            session_id: loopQuote.sessionId,
            accepted_offer_mode: loopQuote.mode,
            fee_amount: loopQuote.chargeInstructions.amount,
            fee_currency: loopQuote.chargeInstructions.currencyCode,
          }),
        },
      },
    },
  );

  returnCartMetafieldId = cartMetadataResp?.body?.data?.resource_id;
  // }

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

  return { cartMetafieldId: returnCartMetafieldId };
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
            value: LOOP_EMPTY_VALUE,
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

  await Promise.all(promises)
    .then((results) => {
      console.log('removeLoopOrderFees results', results);
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
  applyLoopOrderFees,
  shouldUpdateLoopFee,
};
