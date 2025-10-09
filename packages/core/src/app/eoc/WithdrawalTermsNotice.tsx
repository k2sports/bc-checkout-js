import React, { type FunctionComponent, memo, useMemo } from 'react';
import { CustomCheckoutWindow, ManageShippingMethods } from '../auto-loader';
import { TranslatedHtml } from '@bigcommerce/checkout/locale';

const WithdrawalTermsNotice: FunctionComponent = () => {
  const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  const checkoutSettings: ManageShippingMethods | undefined =
    customCheckoutWindow?.checkoutConfig?.manageShippingMethods;

  const url = checkoutSettings?.withdrawalTermsUrl;
  const withdrawalTerms = useMemo(
    () =>
      url ? (
        <p>
          <TranslatedHtml data={{ url }} id="withdrawal_terms.notice_with_link_text" />{' '}
        </p>
      ) : (
        <p>No url</p>
      ),
    [url],
  );

  return withdrawalTerms;
};

export default memo(WithdrawalTermsNotice);
