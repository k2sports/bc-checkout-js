import { Customer, ShippingOption } from '@bigcommerce/checkout-sdk';

import { CustomCheckoutWindow, HideShippingMethods } from '../auto-loader';

import getRecommendedShippingOption from './getRecommendedShippingOption';

export default function getFilteredShippingOptions(
  availableShippingOptions: ShippingOption[] | undefined,
  customer: Customer | undefined,
): ShippingOption[] {
  const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  const hideShippingMethods: HideShippingMethods | undefined =
    customCheckoutWindow?.checkoutConfig?.hideShippingMethods;

  console.log('getFilteredShippingOptions - v35', {
    availableShippingOptions,
    customer,
    hideShippingMethods,
  });

  const shippingOptions = availableShippingOptions || [];

  if (!customer || !hideShippingMethods || !hideShippingMethods?.isEnabled) {
    return shippingOptions;
  }

  const currentCustomerGroupId = customer?.customerGroup?.id;

  // IF the customer is in the customer group THEN hide free shipping options
  if (
    currentCustomerGroupId &&
    hideShippingMethods?.customerGroupIds?.includes(currentCustomerGroupId)
  ) {
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
  if (hideShippingMethods?.showRecommendedMethod) {
    const recommendedOption = getRecommendedShippingOption(shippingOptions);

    return recommendedOption ? [recommendedOption] : shippingOptions;
  }

  return shippingOptions;
}
