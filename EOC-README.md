## EOC File Updates

- packages/core/src/app/auto-loader.ts

```
// eoc custom interface
export interface EOCCheckoutConfig {
  isEnabled: boolean;
  showRecommendedMethod?: boolean;
  hideFreeShippingGroups?: number[];
  withdrawalTermsUrl?: string;
}

export interface CustomCheckoutWindow extends Window {
  checkoutConfig: {
    ...
    manageShippingMethods?: EOCCheckoutConfig; // eoc custom field
  };
}

  console.log('EOC Custom Checkout v3.0.0', window.checkoutConfig); // eoc custom log
```

- packages/core/src/app/checkout/components/CartSummary.tsx

```
import LoopReturnsOption from '../../eoc/loop/LoopReturnsOption'; // eoc custom import

return (
    <LazyContainer loadingSkeleton={<CartSummarySkeleton />}>
    <aside aria-label="Cart Summary" className="layout-cart here">
        <CartSummaryComponent isMultiShippingMode={isMultiShippingMode} />
        <Extension region={ExtensionRegion.SummaryAfter} />
        {/* eoc custom component start */}
        <LoopReturnsOption />
        {/* eoc custom component end */}
    </aside>
    </LazyContainer>
);
```

- packages/core/src/app/order/OrderConfirmation/OrderConfirmation.tsx

```
import { setLoopOrderMetadata } from '../../eoc/loop/checkoutHelpers'; // eoc custom import

  // EOC custom start
  useEffect(() => {
    const handleLoad = async () => {
      if (order) {
        await setLoopOrderMetadata(order);
      }
    };

    if (!isLoadingOrder) {
      handleLoad();
    }
  }, [order, isLoadingOrder]);
  // EOC custom end
```

- packages/core/src/app/payment/PaymentForm.tsx

```
import WithdrawalTermsNotice from '../eoc/WithdrawalTermsNotice'; // eoc custom import
import LoopReturnsOption from '../eoc/loop/LoopReturnsOption'; // eoc custom import

return (
<Form className="checkout-form" testId="payment-form">
    {/* eoc custom component start */}
        {isMobileView && <LoopReturnsOption />}
    {/* eoc custom component end */}

    ...

    {invoicePaymentComment && <InvoicePaymentCommentField />}

    {/* eoc custom component start */}
        <WithdrawalTermsNotice />
    {/* eoc custom component end */}
    ...
</Form>
);
```

- packages/core/src/app/shipping/shippingOption/ShippingOptions.tsx

```
return {
    ...
customer, // eoc custom prop
};
```

- packages/core/src/app/shipping/shippingOption/ShippingOptionsForm.tsx

```
import getFilteredShippingOptions from '../getFilteredShippingOptions'; // eoc custom import

const {
    ...
    customer, // eoc custom prop
} = props;

// Updated vars
const selectDefaultShippingOptions = async ({ data }: CheckoutSelectors) => {
    ...
    const { availableShippingOptions, id } = consignment;
    const filteredShippingOptions = getFilteredShippingOptions(availableShippingOptions, customer);
    // const recommendedOption = getRecommendedShippingOption(availableShippingOptions);
    const recommendedOption = getRecommendedShippingOption(filteredShippingOptions); // eoc custom update
    // const singleShippingOption =
    //   availableShippingOptions.length === 1 && availableShippingOptions[0];
    const singleShippingOption = filteredShippingOptions.length === 1 && filteredShippingOptions[0]; // eoc custom update
    const defaultShippingOption = recommendedOption || singleShippingOption;
    ...
};

return (
    <>
    ...
    <ShippingOptionsList
        consignmentId={consignment.id}
        inputName={`shippingOptionIds.${consignment.id}`}
        isLoading={isLoading(consignment.id)}
        isMultiShippingMode={isMultiShippingMode}
        onSelectedOption={selectShippingOption}
        selectedShippingOptionId={
            consignment.selectedShippingOption && consignment.selectedShippingOption.id
        }
        // shippingOptions={consignment.availableShippingOptions}
        shippingOptions={getFilteredShippingOptions(
            consignment?.availableShippingOptions,
            customer,
        )} // eoc custom update
    />
    </>
);
```

### Translations

Withdrawal Terms & Place Order button

- /Users/naitchison/git/bigcommerce-apps/bc-checkout-js/packages/locale/src/translations/de.json
- /Users/naitchison/git/bigcommerce-apps/bc-checkout-js/packages/locale/src/translations/en.json
- /Users/naitchison/git/bigcommerce-apps/bc-checkout-js/packages/locale/src/translations/es.json
- /Users/naitchison/git/bigcommerce-apps/bc-checkout-js/packages/locale/src/translations/fr.json
- /Users/naitchison/git/bigcommerce-apps/bc-checkout-js/packages/locale/src/translations/it.json

```
"optimized_checkout": {
    ...
    "withdrawal_terms": {
        (de) "notice_with_link_text": "Bitte beachten Sie und unsere <a href=\"{url}\" target=\"_blank\">Widerrufsbelehrung</a>."
        (en) "notice_with_link_text": "Please note our <a href=\"{url}\" target=\"_blank\">withdrawal policy</a>."
        (es) "notice_with_link_text": "Le rogamos que tome nota de nuestra <a href=\"{url}\" target=\"_blank\">política de anulación</a>."
        (fr) "notice_with_link_text": "Veuillez prendre connaissance de notre <a href=\"{url}\" target=\"_blank\">politique de rétractation</a>."
        (it) "notice_with_link_text": "La preghiamo di prendere visione della nostra <a href=\"{url}\" target=\"_blank\">politica di cancellazione</a>."
    }
},
```

## EOC New Files

- /packages/core/src/app/eoc
  - /WithdrawalTermsNotice.tsx
  - /loop
    - /LoopReturnsOption.scss
    - /LoopReturnsOption.tsx
    - /checkoutHelpers.ts
    - /types.ts
