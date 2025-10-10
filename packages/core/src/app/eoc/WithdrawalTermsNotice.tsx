import React, { type FunctionComponent, memo, useMemo } from 'react';
import { CustomCheckoutWindow, ManageShippingMethods } from '../auto-loader';
import { TranslatedHtml } from '@bigcommerce/checkout/locale';
import { Fieldset } from '@bigcommerce/checkout/ui';

const WithdrawalTermsNotice: FunctionComponent = () => {
  const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  const checkoutSettings: ManageShippingMethods | undefined =
    customCheckoutWindow?.checkoutConfig?.manageShippingMethods;

  const url = checkoutSettings?.withdrawalTermsUrl;
  const withdrawalTerms = useMemo(
    () =>
      url ? (
        <Fieldset additionalClassName="withdrawal-terms">
          <p>
            <TranslatedHtml data={{ url }} id="withdrawal_terms.notice_with_link_text" />{' '}
          </p>
        </Fieldset>
      ) : null,
    [url],
  );

  return withdrawalTerms;
};

export default memo(WithdrawalTermsNotice);
