/* eslint-disable prettier/prettier */
import { type Order } from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';

interface CartMetafield {
  id: string;
  value: string;
}

const requestSender = createRequestSender({
  //   host: 'https://fb0d-2601-600-9680-1890-ac23-a6a3-a852-d424.ngrok-free.app/api/v1/',
  host: 'https://dev-eoc-checkout-helper.onrender.com/api/v1/',
});

async function setLoopOrderMetadata(order: Order): Promise<void> {
  console.log('setLoopOrderMetadata', order);

  // get order fees
  const loopFee = order?.fees?.find((fee) => fee.source === 'loop');

  if (!loopFee) {
    return;
  }

  // get cart metadata
  const cartMetadataResp = await requestSender.post(
    `/checkout/bigcommerce/cart-metadata/${order.cartId}/loop_checkout_plus`,
  );

  console.log('cartMetadataResp', cartMetadataResp);

  const loopCartMetadata = cartMetadataResp?.body as CartMetafield;

  if (!loopCartMetadata?.id || !loopCartMetadata?.value) {
    return;
  }

  // set order metafields
  const loopData = JSON.parse(loopCartMetadata.value);

  console.log('loopData', loopData);

  const metafieldKeys = Object.keys(loopData);

  console.log('metafieldKeys', metafieldKeys);

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
      // results is exactly ['Data Pack A', 'Data Pack B', 'Data Pack C']
      console.log(results);
    })
    .catch((error) => {
      console.error('An error occurred:', error);
    });
}

export default setLoopOrderMetadata;
