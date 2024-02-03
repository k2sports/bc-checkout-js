import { ShippingOption } from '@bigcommerce/checkout-sdk';

import { getCustomer } from '../customer/customers.mock';

import { getCustomCheckoutWindow } from './checkoutConfig.mock';
import getFilteredShippingOptions from './getFilteredShippingOptions';
import { getShippingOption } from './shippingOption/shippingMethod.mock';

describe('getFilteredShippingOptions()', () => {
  beforeAll(() => {
    const checkoutConfigMock = getCustomCheckoutWindow().checkoutConfig;

    window.checkoutConfig = {
      ...checkoutConfigMock,
    };
  });

  const customerMock = getCustomer();
  const shippingMethodMock = getShippingOption();

  const freeShippingPromo: ShippingOption = {
    ...shippingMethodMock,
    type: 'freeshipping',
    isRecommended: true,
  };
  const freeShippingMethod: ShippingOption = { ...shippingMethodMock, isRecommended: false };
  const shippingMethod: ShippingOption = { ...shippingMethodMock, isRecommended: false };

  it('Return all shipping methods when manageShippingMethods is undefined', () => {
    expect(
      getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      ),
    ).toHaveLength(3);
  });

  it('Return all shipping methods when manageShippingMethods is disabled', () => {
    window.checkoutConfig.manageShippingMethods = {
      manageShippingMethods: {
        hideFreeShippingGroups: undefined,
        isEnabled: false,
        showRecommendedMethod: false,
      },
    };

    expect(
      getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      ),
    ).toHaveLength(3);
  });

  it('Return all shipping methods when manageShippingMethods is enabled and showRecommendedMethod is false', () => {
    window.checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: undefined,
      isEnabled: true,
      showRecommendedMethod: false,
    };

    expect(
      getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      ),
    ).toHaveLength(3);
  });

  it('Return 1 recommended shipping method when manageShippingMethods is enabled and showRecommendedMethod is true', () => {
    window.checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: undefined,
      isEnabled: true,
      showRecommendedMethod: true,
    };

    expect(
      getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      ),
    ).toHaveLength(1);
  });
});
