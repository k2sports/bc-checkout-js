import {
  CheckoutSelectors,
  Consignment,
  Customer,
  ShippingOption,
} from '@bigcommerce/checkout-sdk';
import { FormikProps, withFormik } from 'formik';
import { noop } from 'lodash';
import React, { PureComponent, ReactNode } from 'react';

import { AnalyticsContextProps } from '@bigcommerce/checkout/analytics';
import { TranslatedString } from '@bigcommerce/checkout/locale';
import { ChecklistSkeleton } from '@bigcommerce/checkout/ui';

import { AddressType, StaticAddress } from '../../address';
import { withAnalytics } from '../../analytics';
import { CustomCheckoutWindow, HideShippingMethods } from '../../auto-loader';
import getRecommendedShippingOption from '../getRecommendedShippingOption';
import StaticConsignmentItemList from '../StaticConsignmentItemList';

import { ShippingOptionsProps, WithCheckoutShippingOptionsProps } from './ShippingOptions';
import './ShippingOptionsForm.scss';
import ShippingOptionsList from './ShippingOptionsList';

export type ShippingOptionsFormProps = ShippingOptionsProps &
  WithCheckoutShippingOptionsProps &
  AnalyticsContextProps;

class CustomShippingOptionsForm extends PureComponent<
  ShippingOptionsFormProps & FormikProps<ShippingOptionsFormValues>
> {
  private unsubscribe?: () => void;

  componentDidMount(): void {
    const { subscribeToConsignments } = this.props;

    this.unsubscribe = subscribeToConsignments(this.selectDefaultShippingOptions);
  }

  componentDidUpdate(): void {
    const { analyticsTracker, consignments, shouldShowShippingOptions } = this.props;

    if (consignments?.length && shouldShowShippingOptions) {
      analyticsTracker.showShippingMethods();
    }
  }

  componentWillUnmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }
  render(): ReactNode {
    const {
      consignments,
      isMultiShippingMode,
      selectShippingOption,
      isLoading,
      shouldShowShippingOptions,
      invalidShippingMessage,
      methodId,
      customer,
    } = this.props;

    const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
    const hideShippingMethods: HideShippingMethods | undefined =
      customCheckoutWindow?.checkoutConfig?.hideShippingMethods;

    if (!consignments?.length || !shouldShowShippingOptions) {
      return (
        <ChecklistSkeleton
          additionalClassName="shippingOptions-skeleton"
          isLoading={isLoading()}
          rows={2}
        >
          {this.renderNoShippingOptions(
            <TranslatedString
              id={
                methodId || isMultiShippingMode
                  ? 'shipping.select_shipping_address_text'
                  : 'shipping.enter_shipping_address_text'
              }
            />,
          )}
        </ChecklistSkeleton>
      );
    }

    return (
      <>
        {consignments.map((consignment) => (
          <div className="shippingOptions-container form-fieldset" key={consignment.id}>
            {isMultiShippingMode && this.renderConsignment(consignment)}

            <ShippingOptionsList
              consignmentId={consignment.id}
              inputName={getRadioInputName(consignment.id)}
              isLoading={isLoading(consignment.id)}
              onSelectedOption={selectShippingOption}
              selectedShippingOptionId={
                consignment.selectedShippingOption && consignment.selectedShippingOption.id
              }
              shippingOptions={filterShippingOptions(consignment, customer, hideShippingMethods)}
            />

            {(!consignment.availableShippingOptions ||
              !consignment.availableShippingOptions.length) && (
              <ChecklistSkeleton
                additionalClassName="shippingOptions-skeleton"
                isLoading={isLoading(consignment.id)}
                rows={2}
              >
                {this.renderNoShippingOptions(invalidShippingMessage)}
              </ChecklistSkeleton>
            )}
          </div>
        ))}
      </>
    );
  }

  private selectDefaultShippingOptions: (state: CheckoutSelectors) => void = async ({ data }) => {
    const { selectShippingOption, setFieldValue } = this.props;

    const consignment = (data.getConsignments() || []).find(
      ({ selectedShippingOption, availableShippingOptions: shippingOptions }) =>
        !selectedShippingOption && shippingOptions,
    );

    if (!consignment || !consignment.availableShippingOptions) {
      return;
    }

    const { availableShippingOptions, id } = consignment;
    const recommendedOption = getRecommendedShippingOption(availableShippingOptions);
    const singleShippingOption =
      availableShippingOptions.length === 1 && availableShippingOptions[0];
    const defaultShippingOption = recommendedOption || singleShippingOption;

    if (!defaultShippingOption) {
      return;
    }

    await selectShippingOption(id, defaultShippingOption.id);
    setFieldValue(`shippingOptionIds.${id}`, defaultShippingOption.id);
  };

  private renderNoShippingOptions(message: ReactNode): ReactNode {
    return (
      <div className="shippingOptions-panel optimizedCheckout-overlay">
        <p
          aria-live="polite"
          className="shippingOptions-panel-message optimizedCheckout-primaryContent"
          role="alert"
        >
          {message}
        </p>
      </div>
    );
  }

  private renderConsignment(consignment: Consignment): ReactNode {
    const { cart } = this.props;

    return (
      <div className="staticConsignment">
        <strong>
          <TranslatedString id="shipping.shipping_address_heading" />
        </strong>

        <StaticAddress address={consignment.shippingAddress} type={AddressType.Shipping} />

        <StaticConsignmentItemList cart={cart} consignment={consignment} />
      </div>
    );
  }
}

function getRadioInputName(consignmentId: string): string {
  return `shippingOptionIds.${consignmentId}`;
}

function filterShippingOptions(
  consignment: Consignment,
  customer: Customer | undefined,
  hideShippingMethods: HideShippingMethods | undefined,
): ShippingOption[] {
  console.log('getFilteredOptions - v11', { consignment, customer, hideShippingMethods });

  const shippingOptions = consignment?.availableShippingOptions || [];

  if (!customer || !hideShippingMethods || !hideShippingMethods?.isEnabled) {
    return shippingOptions;
  }

  // IF the customer is in the customer group THEN hide free shipping options
  if (customer?.customerGroup?.id === hideShippingMethods?.customerGroupId) {
    return shippingOptions.filter((option) => option.cost > 0);
  }

  // Return recommended shipping option
  // const freeShippingOption = shippingOptions.find((option) => option.cost === 0);
  const recommendedOption = getRecommendedShippingOption(shippingOptions);

  return recommendedOption ? [recommendedOption] : shippingOptions;

  // IF free methods exist THEN return first free shipping option
  // const freeShippingOption = shippingOptions.find((option) => option.cost === 0);
  // return freeShippingOption ? [freeShippingOption] : shippingOptions;
}

export interface ShippingOptionsFormValues {
  shippingOptionIds: {
    [shippingOptionIds: string]: string;
  };
}

export default withAnalytics(
  withFormik<ShippingOptionsFormProps, ShippingOptionsFormValues>({
    handleSubmit: noop,
    mapPropsToValues({ consignments }) {
      const shippingOptionIds: { [id: string]: string } = {};

      (consignments || []).forEach((consignment) => {
        shippingOptionIds[consignment.id] = consignment.selectedShippingOption
          ? consignment.selectedShippingOption.id
          : '';
      });

      return { shippingOptionIds };
    },
  })(CustomShippingOptionsForm),
);
