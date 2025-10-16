import {
    type CustomerInitializeOptions,
    type PaymentInitializeOptions,
} from '@bigcommerce/checkout-sdk';
import {
    createStripeLinkV2CustomerStrategy,
    createStripeOCSPaymentStrategy,
} from '@bigcommerce/checkout-sdk/integrations/stripe';
import { noop, some } from 'lodash';
import React, {
    type FunctionComponent,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { HostedWidgetPaymentComponent } from '@bigcommerce/checkout/hosted-widget-integration';
import {
    isInstrumentCardCodeRequiredSelector,
    isInstrumentCardNumberRequiredSelector,
} from '@bigcommerce/checkout/instrument-utils';
import {
    type PaymentMethodProps,
    type PaymentMethodResolveId,
    toResolvableComponent,
} from '@bigcommerce/checkout/payment-integration-api';
import { AccordionContext, ChecklistSkeleton } from '@bigcommerce/checkout/ui';

import { getAppearanceForOCSElement, getFonts } from './getStripeOCSStyles';

const StripeOCSPaymentMethod: FunctionComponent<PaymentMethodProps> = ({
    paymentForm,
    checkoutState,
    checkoutService,
    method,
    onUnhandledError = noop,
    ...rest
}) => {
    const collapseStripeElement = useRef<() => void>();
    const toggleUpdateTimeout = useRef<ReturnType<typeof setTimeout>>();
    const { onToggle, selectedItemId } = useContext(AccordionContext);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | undefined>(
        selectedItemId,
    );
    const [isOCSLoading, setIsOCSLoading] = useState(false);
    const methodSelector = `${method.gateway}-${method.id}`;
    const containerId = `${methodSelector}-component-field`;
    const paymentContext = paymentForm;

    useEffect(() => {
        /* INFO:
         * switching and loading BC accordion item takes more time than preloaded Stripe accordion items, and BC accordion toggle is blocked during loading
         * switching BC accordion items and loading payment methods triggers state update for BC accordion context
         * thats why we need to double call onToggle for BC accordion with actual context state, for cases when the first toggle call has no effect because of loading state
         */
        if (toggleUpdateTimeout.current) {
            clearTimeout(toggleUpdateTimeout.current);
            toggleUpdateTimeout.current = undefined;
        }

        if (!!selectedPaymentMethodId && selectedItemId !== selectedPaymentMethodId) {
            toggleUpdateTimeout.current = setTimeout(() => {
                onToggle(selectedPaymentMethodId);
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onToggle]);

    useEffect(() => {
        if (selectedItemId === methodSelector) {
            return;
        }

        setSelectedPaymentMethodId(selectedItemId);
        collapseStripeElement.current?.();
    }, [selectedItemId, methodSelector]);

    useEffect(() => {
        if (selectedPaymentMethodId !== methodSelector) {
            return;
        }

        onToggle(selectedPaymentMethodId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPaymentMethodId, methodSelector]);

    const renderSubmitButton = useCallback(() => {
        paymentContext.hidePaymentSubmitButton(method, false);
    }, [paymentContext, method]);

    const {
        hidePaymentSubmitButton,
        disableSubmit,
        setFieldValue,
        setSubmit,
        setValidationSchema,
    } = paymentForm;
    const instruments = checkoutState.data.getInstruments(method) || [];

    const {
        data: { getCheckout, isPaymentDataRequired },
        statuses: { isLoadingInstruments },
    } = checkoutState;
    const checkout = getCheckout();
    const {
        initializationData: { isCustomChecklistItem },
    } = method;

    const initializeStripePayment = useCallback(
        async (options: PaymentInitializeOptions) => {
            setIsOCSLoading(true);

            return checkoutService.initializePayment({
                ...options,
                integrations: [createStripeOCSPaymentStrategy],
                stripeocs: {
                    containerId,
                    layout: {
                        type: isCustomChecklistItem ? 'accordion' : 'auto',
                        defaultCollapsed: selectedItemId !== methodSelector,
                        radios: true,
                        linkInAccordion: true,
                        spacedAccordionItems: false,
                        visibleAccordionItemsCount: 0,
                    },
                    appearance: getAppearanceForOCSElement(containerId),
                    fonts: getFonts(),
                    onError: onUnhandledError,
                    render: renderSubmitButton,
                    paymentMethodSelect: setSelectedPaymentMethodId,
                    handleClosePaymentMethod: (collapseElement: () => void) => {
                        collapseStripeElement.current = collapseElement;
                    },
                    togglePreloader: setIsOCSLoading,
                },
            });
        },
        [
            containerId,
            selectedItemId,
            methodSelector,
            isCustomChecklistItem,
            checkoutService,
            onUnhandledError,
            renderSubmitButton,
            setSelectedPaymentMethodId,
            setIsOCSLoading,
        ],
    );

    const renderCustomOCSSectionStyles = () => (
        <style>
            {`
                .custom-checklist-item#radio-${methodSelector} {
                    border-bottom: none;
                }
                .custom-checklist-item#radio-${methodSelector}:last-of-type {
                    margin-bottom: -1px;
                }
            `}
        </style>
    );
    const initializeStripeCustomer = useCallback(
        (options: CustomerInitializeOptions) => {
            return checkoutService.initializeCustomer({
                ...options,
                integrations: [createStripeLinkV2CustomerStrategy],
            });
        },
        [checkoutService],
    );

    const renderCheckoutElementsForStripeOCSStyling = () => (
        <div style={{ display: 'none' }}>
            <div
                className="form-checklist-item optimizedCheckout-form-checklist-item"
                id={`${containerId}--accordion-header`}
            >
                <input
                    className="form-checklist-checkbox optimizedCheckout-form-checklist-checkbox"
                    id={`${containerId}-radio-input`}
                    type="radio"
                />
                <div className="form-label optimizedCheckout-form-label" />
            </div>
            <div
                className="form-checklist-header--selected"
                id={`${containerId}--accordion-header-selected`}
            >
                <input
                    className="form-checklist-checkbox optimizedCheckout-form-checklist-checkbox"
                    defaultChecked
                    id={`${containerId}-radio-input-selected`}
                    type="radio"
                />
                <div className="form-label optimizedCheckout-form-label" />
            </div>
            <div className="optimizedCheckout-form-input" id={`${containerId}--input`}>
                <div className="form-field--error">
                    <div className="optimizedCheckout-form-label" id={`${containerId}--error`} />
                </div>
                <div className="optimizedCheckout-form-label" id={`${containerId}--label`} />
            </div>
        </div>
    );

    const renderPreloader = () => (
        <div data-test="stripe-accordion-skeleton" style={{ padding: '10px 18px' }}>
            <ChecklistSkeleton />
        </div>
    );

    return (
        <>
            {isOCSLoading ? renderPreloader() : renderCustomOCSSectionStyles()}

            <HostedWidgetPaymentComponent
                {...rest}
                containerId={containerId}
                deinitializePayment={checkoutService.deinitializePayment}
                disableSubmit={disableSubmit}
                hideContentWhenSignedOut
                hidePaymentSubmitButton={hidePaymentSubmitButton}
                initializeCustomer={initializeStripeCustomer}
                initializePayment={initializeStripePayment}
                instruments={instruments}
                isInstrumentCardCodeRequired={isInstrumentCardCodeRequiredSelector(checkoutState)}
                isInstrumentCardNumberRequired={isInstrumentCardNumberRequiredSelector(
                    checkoutState,
                )}
                isInstrumentFeatureAvailable={false}
                isLoadingInstruments={isLoadingInstruments()}
                isPaymentDataRequired={isPaymentDataRequired()}
                isSignedIn={some(checkout?.payments, { providerId: method.id })}
                loadInstruments={checkoutService.loadInstruments}
                method={method}
                setFieldValue={setFieldValue}
                setSubmit={setSubmit}
                setValidationSchema={setValidationSchema}
                signOut={checkoutService.signOutCustomer}
            />
            {renderCheckoutElementsForStripeOCSStyling()}
        </>
    );
};

export default toResolvableComponent<PaymentMethodProps, PaymentMethodResolveId>(
    StripeOCSPaymentMethod,
    [{ gateway: 'stripeocs', id: 'optimized_checkout' }],
);
