import React, { type FunctionComponent, memo, useEffect, useMemo } from 'react';
import { CheckboxFormField, Fieldset, Legend } from '@bigcommerce/checkout/ui';
import { useCheckout } from '@bigcommerce/checkout/contexts';
import { LineItem } from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';

const requestSender = createRequestSender({
  host: 'https://2975-2601-600-9680-1890-85c9-b119-2b79-1c43.ngrok-free.app/api/v1/',
});

const LoopReturnsOption: FunctionComponent = () => {
  // const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  // const checkoutSettings: ManageShippingMethods | undefined =
  //   customCheckoutWindow?.checkoutConfig?.manageShippingMethods;

  // ApiRequestsSender?
  // rest.get('/api/storefront/checkout/*', (_, res, ctx) => res(ctx.json(checkout))),

  // const {
  //           data: {
  //               getCart,
  //               getConfig,
  //               getCustomer,
  //               getInstruments,
  //               isPaymentDataRequired,
  //               isPaymentDataSubmitted,
  //               getCheckout,
  //           },
  //           statuses: { isLoadingInstruments },
  //       } = checkoutState;

  //       const cart = getCart();
  const isLoopEnabled = true; //checkoutSettings?.withdrawalTermsUrl;

  const {
    selectedState: { checkout },
  } = useCheckout(({ data }) => ({
    checkout: data.getCheckout(),
  }));

  const cart = checkout?.cart;

  console.log('cart', cart);
  console.log('checkout', checkout);

  const legend = useMemo(
    () => (
      <Legend>
        {/* <TranslatedString id="shipping.order_comment_label" /> */}
        Returns Coverage
      </Legend>
    ),
    [],
  );

  const labelContent = useMemo(
    () => 'Free returns with for $7.12', // <TranslatedString id="billing.use_shipping_address_label" />,
    [],
  );

  const dollarsToCents = (amount: number) => {
    return Math.round(amount * 100);
  };

  const onChange = async (isChecked: boolean) => {
    console.log('Loop Returns Option checked:', isChecked);

    const currencyCode = cart?.currency.code;
    const allItems = Object.values(cart?.lineItems || {}).flat();
    const cartItems = allItems?.map((item: LineItem) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: {
        amount: dollarsToCents(item.listPrice),
        currencyCode: currencyCode,
      },
      totalPrice: {
        amount: dollarsToCents(item.extendedSalePrice),
        currencyCode: currencyCode,
      },
      originalTotalPrice: {
        amount: dollarsToCents(item.extendedListPrice),
        currencyCode: currencyCode,
      },
      title: item.name,
    }));

    console.log('cartItems', cartItems);

    const reqBody = {
      platform: 'bigcommerce',
      region: 'US',
      cartId: cart?.id,
      cart: {
        lines: cartItems,
        itemCount: cartItems.length, // i think this is wrong
        subtotalAmount: dollarsToCents(checkout?.subtotal || 0),
        totalDiscountAmount: dollarsToCents(checkout?.totalDiscount || 0),
        discountedSubtotalAmount: dollarsToCents(checkout?.subtotal || 0),
        totalTaxAmount: dollarsToCents(checkout?.taxTotal || 0),
        totalAmount: dollarsToCents(checkout?.grandTotal || 0),
        currencyCode: currencyCode,
      },
    };

    console.log('data to send to Loop API:', reqBody);

    const test = await requestSender.post('/checkout/loop/analyze', {
      body: reqBody,
    });
    console.log('hello????', test);
  };

  useEffect(() => {
    console.log('Loop Returns Option component mounted');
  }, []);

  const loopReturnsOption = useMemo(
    () =>
      isLoopEnabled ? (
        <Fieldset
          legend={legend}
          testId="checkout-shipping-loop-returns"
          additionalClassName="loop-returns"
        >
          <CheckboxFormField
            id="loopReturnsOption"
            labelContent={labelContent}
            name="loopReturnsOption"
            onChange={onChange}
            // testId="loopReturnsOption"
          />
        </Fieldset>
      ) : null,
    [isLoopEnabled],
  );

  return loopReturnsOption;
};

export default memo(LoopReturnsOption);
