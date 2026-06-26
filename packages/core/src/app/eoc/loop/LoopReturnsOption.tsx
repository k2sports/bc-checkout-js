import React, { type FunctionComponent, memo, useMemo } from 'react';
import { CheckboxFormField, Fieldset, Legend } from '@bigcommerce/checkout/ui';

const LoopReturnsOption: FunctionComponent = () => {
  // const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  // const checkoutSettings: ManageShippingMethods | undefined =
  //   customCheckoutWindow?.checkoutConfig?.manageShippingMethods;

  // ApiRequestsSender?
  // rest.get('/api/storefront/checkout/*', (_, res, ctx) => res(ctx.json(checkout))),

  const isLoopEnabled = true; //checkoutSettings?.withdrawalTermsUrl;

  const legend = useMemo(
    () => (
      <Legend>
        {/* <TranslatedString id="shipping.order_comment_label" /> */}
        Returns
      </Legend>
    ),
    [],
  );

  const labelContent = useMemo(
    () => 'Free returns with Checkout+ for $10.00', // <TranslatedString id="billing.use_shipping_address_label" />,
    [],
  );

  const loopReturnsOption = useMemo(
    () =>
      isLoopEnabled ? (
        <Fieldset
          legend={legend}
          testId="checkout-shipping-loop-returns"
          additionalClassName="loop-returns"
        >
          <p>Lets put loop things in here!</p>
          <CheckboxFormField
            id="loopReturnsOption"
            labelContent={labelContent}
            name="loopReturnsOption"
            // onChange={onChange}
            // testId="loopReturnsOption"
          />
        </Fieldset>
      ) : null,
    [isLoopEnabled],
  );

  return loopReturnsOption;
};

export default memo(LoopReturnsOption);
