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

  describe('When manageShippingMethods is undefined or disabled', () => {
    test('Return all shipping methods', () => {
      expect(
        getFilteredShippingOptions(
          [freeShippingMethod, freeShippingPromo, shippingMethod],
          customerMock,
        ),
      ).toHaveLength(3);

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
  });

  describe("When manageShippingMethods is enabled and hideFreeShippingGroups includes the customer's group", () => {
    beforeAll(() => {
      (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
        hideFreeShippingGroups: [1],
        isEnabled: true,
        showRecommendedMethod: true,
      };
    });

    test('Return free shipping promo if it exists', () => {
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

    test("Return non-free method if promo doesn't exist", () => {
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
  });

  describe("When manageShippingMethods is enabled and hideFreeShippingGroups does not include the customer's group", () => {
    test('Return recommended method when showRecommendedMethod is true', () => {
      (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
        hideFreeShippingGroups: [2],
        isEnabled: true,
        showRecommendedMethod: true,
      };

      let availableMethods = getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      );

      expect(availableMethods).toHaveLength(1);
      expect(availableMethods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'freeshipping',
            isRecommended: true,
          }),
        ]),
      );

      const freeShippingMethodRecommended: ShippingOption = {
        ...shippingMethodMock,
        isRecommended: true,
      };

      availableMethods = getFilteredShippingOptions(
        [freeShippingMethodRecommended, shippingMethod],
        customerMock,
      );

      expect(availableMethods).toHaveLength(1);
      expect(availableMethods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'shipping_flatrate',
            cost: 0,
            isRecommended: true,
          }),
        ]),
      );
    });

    test('Return all shipping methods when showRecommendedMethod is false', () => {
      (window as unknown as CustomCheckoutWindow).checkoutConfig.manageShippingMethods = {
        hideFreeShippingGroups: [2],
        isEnabled: true,
        showRecommendedMethod: false,
      };

      let availableMethods = getFilteredShippingOptions(
        [freeShippingMethod, freeShippingPromo, shippingMethod],
        customerMock,
      );

      expect(getFilteredShippingOptions(availableMethods, customerMock)).toHaveLength(3);

      const freeShippingMethodRecommended: ShippingOption = {
        ...shippingMethodMock,
        isRecommended: true,
      };

      availableMethods = getFilteredShippingOptions(
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
});
