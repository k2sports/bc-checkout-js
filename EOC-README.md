## EOC File Updates

- packages/core/src/app/auto-loader.ts

```
export interface ManageShippingMethods {
  isEnabled: boolean;
  showRecommendedMethod?: boolean;
  hideFreeShippingGroups?: number[];
  withdrawalTermsUrl?: string;
}

export interface CustomCheckoutWindow extends Window {
  checkoutConfig: {
    ...
    manageShippingMethods?: ManageShippingMethods; // eoc custom field
  };
}

  console.log('EOC Custom Checkout v3.0.0', window.checkoutConfig); // eoc custom log
```

- packages/core/src/app/payment/PaymentForm.tsx

```
from '../eoc/WithdrawalTermsNotice'; // eoc custom import

{/* eoc custom component start */}
<WithdrawalTermsNotice />
{/* eoc custom component end */}
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
const { availableShippingOptions, id } = consignment;
const filteredShippingOptions = getFilteredShippingOptions(availableShippingOptions, customer);
// const recommendedOption = getRecommendedShippingOption(availableShippingOptions);
const recommendedOption = getRecommendedShippingOption(filteredShippingOptions);
// const singleShippingOption =
//   availableShippingOptions.length === 1 && availableShippingOptions[0];
const singleShippingOption = filteredShippingOptions.length === 1 && filteredShippingOptions[0];
const defaultShippingOption = recommendedOption || singleShippingOption;

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
    )}
/>
```
