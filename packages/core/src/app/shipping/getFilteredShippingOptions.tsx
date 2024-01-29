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

  // IF the customer is in the customer group THEN hide free shipping options
  if (customer?.customerGroup?.id === hideShippingMethods?.customerGroupId) {
    return shippingOptions.filter((option) => option.cost > 0);
  }

  // Return recommended shipping option (should always be the free option)
  const recommendedOption = getRecommendedShippingOption(shippingOptions);

  return recommendedOption ? [recommendedOption] : shippingOptions;

  // IF free methods exist THEN return first free shipping option
  // const freeShippingOption = shippingOptions.find((option) => option.cost === 0);
  // return freeShippingOption ? [freeShippingOption] : shippingOptions;
}
