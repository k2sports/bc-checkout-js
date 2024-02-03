import { Customer, ShippingOption } from '@bigcommerce/checkout-sdk';

import { CustomCheckoutWindow, ManageShippingMethods } from '../auto-loader';

import getRecommendedShippingOption from './getRecommendedShippingOption';

export default function getFilteredShippingOptions(
  availableShippingOptions: ShippingOption[] | undefined,
  customer: Customer | undefined,
): ShippingOption[] {
  const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  const manageShippingMethods: ManageShippingMethods | undefined =
    customCheckoutWindow?.checkoutConfig?.manageShippingMethods;

  console.log('getFilteredShippingOptions', {
    // availableShippingOptions,
    // customer,
    manageShippingMethods,
  });

  const shippingOptions = availableShippingOptions || [];

  if (!customer || !manageShippingMethods || !manageShippingMethods?.isEnabled) {
    console.log('here', !customer, !manageShippingMethods, !manageShippingMethods?.isEnabled);

    return shippingOptions;
  }

  const currentCustomerGroupId = customer?.customerGroup?.id;

  // IF the customer is in the customer group THEN hide free shipping options
  if (
    currentCustomerGroupId &&
    manageShippingMethods?.hideFreeShippingGroups?.includes(currentCustomerGroupId)
  ) {
    console.log('and here');

    // Allow the free shipping promotion
    const freeShippingPromoOption = shippingOptions.find(
      (option) => option.type === 'freeshipping',
    );

    if (freeShippingPromoOption) {
      return [freeShippingPromoOption];
    }

    return shippingOptions.filter((option) => option.cost > 0);
  }

  // IF showRecommendedMethod is true THEN return recommended shipping option (should always be the free option)
  if (manageShippingMethods?.showRecommendedMethod) {
    console.log('doing this');

    const recommendedOption = getRecommendedShippingOption(shippingOptions);

    return recommendedOption ? [recommendedOption] : shippingOptions;
  }

  console.log('nope');

  return shippingOptions;
}
