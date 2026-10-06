// EOC Component
import React, {
  ChangeEvent,
  type FunctionComponent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Button,
  ButtonSize,
  ButtonVariant,
  Legend,
  LoadingOverlay,
  Modal,
  ModalHeader,
} from '@bigcommerce/checkout/ui';
import { useCheckout } from '@bigcommerce/checkout/contexts';
import { Fee } from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';
import { ShopperCurrency } from '../../currency';
import {
  centsToDollars,
  dollarsToCents,
  getCartMetadataAmount,
  getLoopQuote,
  getReturnsCartItem,
  removeLoopOrderFees,
  shouldRemoveLoopFee,
} from './checkoutHelpers';
import { CustomCheckoutWindow, EOCCheckoutConfig } from '../../auto-loader';
import './LoopReturnsOption.scss';
import IconInfo from '@bigcommerce/checkout/ui/icon/IconInfo';
import DOMPurify from 'dompurify';
import ErrorModal from '../../common/error/ErrorModal';
import {
  CartMetadataResp,
  CartMetafield,
  LoopQuote,
  FEE_DISPLAY_NAME,
  LOOP_NAMESPACE,
} from './types';

const requestSender = createRequestSender({
  host: 'https://eoc-checkout-helper.onrender.com/api/v1/',
});

const LoopReturnsOption: FunctionComponent = () => {
  const [checkoutSettings, setCheckoutSettings] = useState<EOCCheckoutConfig | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loopQuote, setLoopQuote] = useState<LoopQuote | null>(null);
  const [loopOrderFee, setLoopOrderFee] = useState<Fee | null>(null);
  const [cartMetafieldId, setCartMetafieldId] = useState<string | null>(null);
  const [isLoopFieldChecked, setIsLoopFieldChecked] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isLoopAvailable, setIsLoopAvailable] = useState(true);
  const [modalError, setModalError] = useState<Error | undefined>();
  const [ghostSku, setGhostSku] = useState('LOOP');
  const {
    selectedState: { checkout },
    checkoutService,
  } = useCheckout(({ data }) => ({
    checkout: data.getCheckout(),
  }));

  const onCloseErrorModal = useCallback((): void => {
    setModalError(undefined);
    // window.location.reload();
  }, []);

  const onRequestClose = () => {
    setIsInfoModalOpen((prevState) => !prevState);
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setIsLoopFieldChecked(isChecked);

    try {
      if (isChecked && loopQuote?.chargeInstructions?.amount) {
        // Apply custom fee to checkout
        const orderFeesResp = await requestSender.post('/checkout/bigcommerce/update-order-fees', {
          body: {
            checkoutId: checkout?.id,
            fee: {
              id: loopOrderFee?.id,
              type: 'custom_fee',
              name: LOOP_NAMESPACE,
              display_name: FEE_DISPLAY_NAME,
              cost: centsToDollars(loopQuote.chargeInstructions.amount), // convert cents to dollars
              source: 'loop',
              tax_class_id: checkoutSettings?.returnsTaxId,
            },
          },
        });

        // Add loop data to cart metadata for future access
        const cartMetadataResp: CartMetadataResp = await requestSender.post(
          '/checkout/bigcommerce/cart-metadata',
          {
            body: {
              checkoutId: checkout?.id,
              metafield: {
                id: cartMetafieldId,
                permission_set: 'write_and_sf_access',
                namespace: LOOP_NAMESPACE,
                key: LOOP_NAMESPACE,
                value: JSON.stringify({
                  session_id: loopQuote.sessionId,
                  accepted_offer_mode: loopQuote.mode,
                  fee_amount: loopQuote.chargeInstructions.amount,
                  fee_currency: loopQuote.chargeInstructions.currencyCode,
                }),
              },
            },
          },
        );

        setCartMetafieldId(cartMetadataResp?.body?.data?.resource_id || null);

        // Add ghost item for netsuite support
        const returnsItemId = getReturnsCartItem(checkout?.cart?.lineItems, ghostSku);
        if (!returnsItemId) {
          const cartItemsResp = await requestSender.post('/checkout/bigcommerce/cart-items', {
            body: {
              checkoutId: checkout?.id,
              items: {
                custom_items: [
                  {
                    sku: ghostSku,
                    name: FEE_DISPLAY_NAME,
                    list_price: 0,
                    quantity: 1,
                    image_url: 'https://k2sports.a.bigcontent.io/v1/static/returns-icon',
                  },
                ],
              },
            },
          });
        }
      } else {
        // Delete fee and cart metadata if unchecked
        if (checkout?.id) {
          const removeResp = await removeLoopOrderFees(
            checkout.id,
            loopOrderFee,
            cartMetafieldId,
            checkout.cart.lineItems,
            ghostSku,
          );
          if (removeResp.error) {
            setModalError(new Error(removeResp?.message));
          }
        }
        // setCartMetafieldId(null);
        setLoopOrderFee(null);
      }
    } catch (error) {
      console.error('Error sending data to BC API:', error);
      setModalError(error as Error);
    } finally {
      checkoutService.loadCheckout();
    }
  };

  useEffect(() => {
    const initializeLoop = async () => {
      try {
        setIsInitializing(true);
        const customCheckoutWindow: CustomCheckoutWindow =
          window as unknown as CustomCheckoutWindow;
        const checkoutSettings: EOCCheckoutConfig | undefined =
          customCheckoutWindow?.checkoutConfig?.manageShippingMethods;
        setCheckoutSettings(checkoutSettings || null);
        setGhostSku(checkoutSettings?.returnsGhostSku || 'LOOP');

        if (!checkout || !checkout?.cart || !checkout?.id || !checkoutSettings?.enableReturns) {
          // disable loop
          setIsInitializing(false);
          setIsLoopAvailable(false);
          return;
        }

        // Get cart metadata
        const cartMetadataResp = await requestSender.post(
          `/checkout/bigcommerce/cart-metadata/${checkout?.id}/${LOOP_NAMESPACE}`,
        );
        const loopCartMetadata = cartMetadataResp?.body as CartMetafield;
        const loopCartMetadataAmount = getCartMetadataAmount(loopCartMetadata);

        // Get & set loop fee if it's been applied
        const appliedLoopOrderFee = checkout?.fees?.find((fee) => fee.name === LOOP_NAMESPACE);

        const customerGroupId = checkout?.customer?.customerGroup?.id;

        // Check if Loop is disabled for the customer's group
        if (customerGroupId && checkoutSettings.returnsHideGroups?.includes(customerGroupId)) {
          const removeResp = await removeLoopOrderFees(
            checkout?.id,
            appliedLoopOrderFee || null,
            loopCartMetadata?.id,
            checkout.cart.lineItems,
            ghostSku,
          );

          if (removeResp.error) {
            setModalError(new Error(removeResp?.message));
          }

          setIsLoopAvailable(false);
          setLoopOrderFee(null);
          setIsLoopFieldChecked(false);
          // setCartMetafieldId(null);
          setIsInitializing(false);
          checkoutService.loadCheckout();
          return;
        } else {
          setIsLoopAvailable(true);
        }

        // Check if there are upcharges for the customer's group
        const customerGroupUpcharge =
          customerGroupId && checkoutSettings?.returnsUpchargeRates
            ? checkoutSettings?.returnsUpchargeRates?.find((config) =>
                config.returnsUpchargeGroup?.includes(customerGroupId),
              )
            : undefined;

        // Get loop quote
        const loopQuoteData = await getLoopQuote(checkout.cart, checkout);

        // Apply upcharge if applicable
        if (customerGroupUpcharge && loopQuoteData) {
          const newRate =
            loopQuoteData.chargeInstructions.amount +
            dollarsToCents(Number(customerGroupUpcharge.returnsUpchargeRate));

          loopQuoteData.chargeInstructions.amount = newRate;
        }

        setLoopQuote(loopQuoteData);

        if (
          shouldRemoveLoopFee(
            loopQuoteData,
            appliedLoopOrderFee,
            loopCartMetadata,
            checkout.cart.lineItems,
            ghostSku,
          )
        ) {
          const removeResp = await removeLoopOrderFees(
            checkout?.id,
            appliedLoopOrderFee || null,
            loopCartMetadata?.id,
            checkout.cart.lineItems,
            ghostSku,
          );

          if (removeResp.error) {
            setModalError(new Error(removeResp?.message));
          }

          setLoopOrderFee(null);
          setIsLoopFieldChecked(false);
          // setCartMetafieldId(null);
          checkoutService.loadCheckout();
          setIsInitializing(false);

          return;
        }

        // Set order fee if cart metadata exists and matched loop quote
        if (
          loopQuoteData?.chargeInstructions?.amount &&
          !appliedLoopOrderFee &&
          loopCartMetadataAmount === loopQuoteData.chargeInstructions.amount
        ) {
          await requestSender.post('/checkout/bigcommerce/update-order-fees', {
            body: {
              checkoutId: checkout?.id,
              fee: {
                id: loopOrderFee?.id,
                type: 'custom_fee',
                name: LOOP_NAMESPACE,
                display_name: 'Returns Coverage',
                cost: centsToDollars(loopQuoteData.chargeInstructions.amount), // convert cents to dollars
                source: 'loop',
                tax_class_id: checkoutSettings?.returnsTaxId,
              },
            },
          });

          checkoutService.loadCheckout();
          setIsInitializing(false);
          return;
        }

        setLoopOrderFee(appliedLoopOrderFee || null);
        setIsLoopFieldChecked(appliedLoopOrderFee ? true : false);
        setCartMetafieldId(loopCartMetadata?.id || null);
      } catch (error) {
        // hide loop
        setModalError(error as Error);
      } finally {
        setIsInitializing(false);
      }
    };

    if (!isInitializing) {
      void initializeLoop();
    }
  }, [checkout?.cart, checkout?.customer, checkout?.subtotal]);

  const loopReturnsOption = useMemo(
    () =>
      checkoutSettings?.enableReturns && isLoopAvailable ? (
        <>
          <form className="loop-returns-option-form">
            <LoadingOverlay isLoading={isInitializing}>
              <fieldset>
                <div className="loop-legend">
                  <Legend>{checkoutSettings?.returnsFormTitle || 'Returns Coverage'}</Legend>
                  <Button
                    variant={ButtonVariant.Secondary}
                    size={ButtonSize.Tiny}
                    onClick={onRequestClose}
                  >
                    <IconInfo />
                  </Button>
                </div>
                {loopQuote && loopQuote?.eligible ? (
                  <div className="form-body">
                    <div className="form-field">
                      <input
                        id="loopReturnsOption"
                        name="loopReturnsOption"
                        type="checkbox"
                        checked={isLoopFieldChecked}
                        onChange={handleChange}
                        className="form-checkbox optimizedCheckout-form-checkbox 
                    floating-form-field-input"
                      />
                      <label
                        htmlFor="loopReturnsOption"
                        className="form-label optimizedCheckout-form-label body-regular"
                      >
                        <span className="body-regular">
                          {checkoutSettings?.returnsFieldLabel || 'Free returns for '}
                          <ShopperCurrency
                            amount={centsToDollars(loopQuote?.chargeInstructions?.amount || 0)}
                          />
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p>Your order is not eligible for free returns coverage</p>
                )}
              </fieldset>
            </LoadingOverlay>
          </form>
          <Modal
            header={
              <ModalHeader>{checkoutSettings?.returnsFormTitle || 'Returns Coverage'}</ModalHeader>
            }
            isOpen={isInfoModalOpen}
            onRequestClose={onRequestClose}
            shouldShowCloseButton={true}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(checkoutSettings?.returnsModalText || ''),
              }}
            />
          </Modal>
          <ErrorModal
            error={modalError}
            message="Please refresh and try again."
            onClose={onCloseErrorModal}
            shouldShowErrorCode={false}
          />
        </>
      ) : null,
    [
      checkoutSettings,
      isInitializing,
      loopQuote,
      loopOrderFee,
      isLoopFieldChecked,
      cartMetafieldId,
      checkout,
      isInfoModalOpen,
      isLoopAvailable,
      modalError,
    ],
  );

  return loopReturnsOption;
};

export default memo(LoopReturnsOption);
