import { ShippingOption } from '@bigcommerce/checkout-sdk';

import { CustomCheckoutWindow } from '../auto-loader';
import { getCustomer } from '../customer/customers.mock';

import { getCustomCheckoutWindow } from './checkoutConfig.mock';
import getFilteredShippingOptions from './getFilteredShippingOptions';
import { getShippingOption } from './shippingOption/shippingMethod.mock';

describe('getFilteredShippingOptions()', () => {
  beforeAll(() => {
    const checkoutConfigMock = getCustomCheckoutWindow().checkoutConfig;

    (window as unknown as CustomCheckoutWindow).checkoutConfig = {
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
  const shippingMethod: ShippingOption = { ...shippingMethodMock, isRecommended: false, cost: 5 };

  it('Return all shipping methods when manageShippingMethods is undefined', () => {
    expect(
      getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      ),
    ).toHaveLength(3);
  });

  it('Return all shipping methods when manageShippingMethods is disabled', () => {
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: undefined,
      isEnabled: false,
      showRecommendedMethod: false,
    };

    expect(
      getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      ),
    ).toHaveLength(3);
  });

  it('Return all shipping methods when manageShippingMethods is enabled and showRecommendedMethod is false', () => {
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
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
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
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

  it("Returns free shipping promo when manageShippingMethods is enabled and hideFreeShippingGroups matches the customer's group", () => {
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: [1],
      isEnabled: true,
      showRecommendedMethod: true,
    };

    const availableMethods = getFilteredShippingOptions(
      [freeShippingMethod, freeShippingPromo, shippingMethod],
      customerMock,
    );

    expect(availableMethods).toHaveLength(1);
    expect(availableMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'freeshipping',
        }),
      ]),
    );
  });

  it("Returns non-free method when manageShippingMethods is enabled and hideFreeShippingGroups matches the customer's group", () => {
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: [1],
      isEnabled: true,
      showRecommendedMethod: true,
    };

    const availableMethods = getFilteredShippingOptions(
      [freeShippingMethod, shippingMethod],
      customerMock,
    );

    expect(availableMethods).toHaveLength(1);
    expect(availableMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'shipping_flatrate',
          cost: 5,
        }),
      ]),
    );
  });

  it("Returns free shipping promo when manageShippingMethods is enabled and hideFreeShippingGroups does not match the customer's group", () => {
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: [2],
      isEnabled: true,
      showRecommendedMethod: true,
    };

    const availableMethods = getFilteredShippingOptions(
      [freeShippingMethod, freeShippingPromo, shippingMethod],
      customerMock,
    );

    expect(availableMethods).toHaveLength(1);
    expect(availableMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'freeshipping',
        }),
      ]),
    );
  });

  it("Returns free method when manageShippingMethods is enabled and hideFreeShippingGroups does not match the customer's group and showRecommendedMethod is true", () => {
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: [2],
      isEnabled: true,
      showRecommendedMethod: true,
    };

    const freeShippingMethodRecommended: ShippingOption = {
      ...shippingMethodMock,
      isRecommended: true,
    };

    const availableMethods = getFilteredShippingOptions(
      [freeShippingMethodRecommended, shippingMethod],
      customerMock,
    );

    expect(availableMethods).toHaveLength(1);
    expect(availableMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'shipping_flatrate',
          cost: 0,
        }),
      ]),
    );
  });

  it("Returns 2 methods when manageShippingMethods is enabled and hideFreeShippingGroups does not match the customer's group and showRecommendedMethod is false", () => {
    (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
      hideFreeShippingGroups: [2],
      isEnabled: true,
      showRecommendedMethod: false,
    };

    const freeShippingMethodRecommended: ShippingOption = {
      ...shippingMethodMock,
      isRecommended: true,
    };

    const availableMethods = getFilteredShippingOptions(
      [freeShippingMethodRecommended, shippingMethod],
      customerMock,
    );

    expect(availableMethods).toHaveLength(2);
    expect(availableMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'shipping_flatrate',
          cost: 0,
        }),
        expect.objectContaining({
          type: 'shipping_flatrate',
          cost: 5,
        }),
      ]),
    );
  });
});
