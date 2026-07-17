/* eslint-disable prettier/prettier */
import { type Fee, type Order } from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';

import { type CartMetafield } from './types';

const requestSender = createRequestSender({
  //   host: 'https://subconsciously-pointless-jeanne.ngrok-free.dev/api/v1/',
  host: 'https://dev-eoc-checkout-helper.onrender.com/api/v1/',
});

async function setLoopOrderMetadata(order: Order): Promise<void> {
  // Get order fees
  const loopFee = order?.fees?.find((fee) => fee.source === 'loop');

  if (!loopFee) {
    return;
  }

  // Get cart metadata
  const cartMetadataResp = await requestSender.post(
    `/checkout/bigcommerce/cart-metadata/${order.cartId}/loop_checkout_plus`,
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
            namespace: 'loop_checkout_plus',
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
      console.log(results);
    })
    .catch((error) => {
      console.error('An error occurred:', error);
    });
}

async function removeOrderFees(
  checkoutId: string,
  customLoopFee: Fee | null,
  cartMetafieldId: string | null,
) {
  const promises = [];

  if (customLoopFee) {
    promises.push(
      requestSender.delete('/checkout/bigcommerce/delete-order-fees', {
        body: {
          checkoutId,
          fee: {
            id: customLoopFee?.id,
          },
        },
      }),
    );

    // console.log('clear order fee', orderFeesResp);
    // setCustomLoopFee(null);
  }

  if (cartMetafieldId) {
    // todo: delete metadata
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

    // console.log('clear cart metafield', cartMetadataResp);
    // setCartMetafieldId(null);
  }

  await Promise.all(promises)
    .then((results) => {
      console.log(results);
    })
    .catch((error) => {
      console.error('An error occurred:', error);
    });
}

export { setLoopOrderMetadata, removeOrderFees };
