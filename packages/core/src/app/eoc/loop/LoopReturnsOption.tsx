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
import { CartMetadataResp, CartMetafield, LoopQuote } from './types';
import {
  centsToDollars,
  dollarsToCents,
  FEE_DISPLAY_NAME,
  getCartMetadataAmount,
  getLoopQuote,
  getReturnsCartItem,
  LOOP_NAMESPACE,
  removeLoopOrderFees,
  RETURNS_ITEM_SKU,
  shouldRemoveLoopFee,
} from './checkoutHelpers';
import { CustomCheckoutWindow, EOCCheckoutConfig } from '../../auto-loader';
import './LoopReturnsOption.scss';
import IconInfo from '@bigcommerce/checkout/ui/icon/IconInfo';
import DOMPurify from 'dompurify';
import ErrorModal from '../../common/error/ErrorModal';

const requestSender = createRequestSender({
  // host: 'https://subconsciously-pointless-jeanne.ngrok-free.dev/api/v1/',
  host: 'https://dev-eoc-checkout-helper.onrender.com/api/v1/',
});

// done:
// 1. check if loop is enabled in checkout settings
// 2. check if loop fee was already added
// 3. analyze cart and get quote from loop api
// 4. if quote is different than current fee, remove fee and uncheck
// 4. if quote is not eligible, remove fee and hide checkbox
// 5, if quote is same as current fee, check and show quote
// 6. if checked, add to order, reload checkout
// 7. if order/cart/customer changes, redo steps 3-6
// 8. if cart metadata same as loop quote but no fee, then add the fee

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
  const {
    selectedState: { checkout },
    checkoutService,
  } = useCheckout(({ data }) => ({
    checkout: data.getCheckout(),
  }));

  const onCloseErrorModal = useCallback((): void => {
    console.log('can we just close this??');
    setModalError(undefined);
    // window.location.reload();
  }, []);

  const onRequestClose = () => {
    setIsInfoModalOpen((prevState) => !prevState);
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setIsLoopFieldChecked(isChecked);
    console.log('Loop Returns Option checked::', { isChecked, loopQuote, loopOrderFee });

    try {
      if (isChecked && loopQuote?.chargeInstructions?.amount) {
        console.log('UPDATE, checked option');
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
            },
          },
        });

        console.log('orderFeesResp:: ', orderFeesResp);

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

        console.log('cartMetadataResp:: ', cartMetadataResp);
        setCartMetafieldId(cartMetadataResp?.body?.data?.resource_id || null);

        // Add ghost item for netsuite support
        const returnsItemId = getReturnsCartItem(checkout?.cart?.lineItems);
        console.log('add returns item? ', returnsItemId);
        if (!returnsItemId) {
          const cartItemsResp = await requestSender.post('/checkout/bigcommerce/cart-items', {
            body: {
              checkoutId: checkout?.id,
              items: {
                custom_items: [
                  {
                    sku: RETURNS_ITEM_SKU,
                    name: FEE_DISPLAY_NAME,
                    list_price: 0,
                    quantity: 1,
                  },
                ],
                // version: checkout?.version,
              },
            },
          });

          console.log('cartItemsResp:: ', cartItemsResp);
        }
      } else {
        // Delete fee and cart metadata if unchecked
        if (checkout?.id) {
          console.log('DELETE, unchecked option');
          const removeResp = await removeLoopOrderFees(
            checkout.id,
            loopOrderFee,
            cartMetafieldId,
            checkout.cart.lineItems,
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
      console.log('Loop Returns Option component initializing');
      try {
        setIsInitializing(true);
        const customCheckoutWindow: CustomCheckoutWindow =
          window as unknown as CustomCheckoutWindow;
        const checkoutSettings: EOCCheckoutConfig | undefined =
          customCheckoutWindow?.checkoutConfig?.manageShippingMethods;
        setCheckoutSettings(checkoutSettings || null);
        console.log('checkoutSettings', checkoutSettings);

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
        console.log('loopCartMetadata', loopCartMetadata);
        const loopCartMetadataAmount = getCartMetadataAmount(loopCartMetadata);

        // Get & set loop fee if it's been applied
        console.log('checkout', checkout);
        const appliedLoopOrderFee = checkout?.fees?.find((fee) => fee.name === LOOP_NAMESPACE);
        console.log('appliedLoopOrderFee', appliedLoopOrderFee);

        const customerGroupId = checkout?.customer?.customerGroup?.id;
        console.log('Customer Group Id:', customerGroupId);
        console.log('Disable Loop for these customer groups:', checkoutSettings.returnsHideGroups);

        // Check if Loop is disabled for the customer's group
        if (customerGroupId && checkoutSettings.returnsHideGroups?.includes(customerGroupId)) {
          console.log('Loop is disbled for the current customer group');
          const removeResp = await removeLoopOrderFees(
            checkout?.id,
            appliedLoopOrderFee || null,
            loopCartMetadata?.id,
            checkout.cart.lineItems,
            // checkout.version,
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
        console.log('Upcharge for these customer groups:', customerGroupUpcharge);

        // Get loop quote
        const loopQuoteData = await getLoopQuote(checkout.cart, checkout);

        // Apply upcharge if applicable
        if (customerGroupUpcharge && loopQuoteData) {
          const newRate =
            loopQuoteData.chargeInstructions.amount +
            dollarsToCents(Number(customerGroupUpcharge.returnsUpchargeRate));

          loopQuoteData.chargeInstructions.amount = newRate;
          console.log(' new combined rate', newRate);
        }

        console.log('loopQuoteData', loopQuoteData);
        setLoopQuote(loopQuoteData);

        if (
          shouldRemoveLoopFee(
            loopQuoteData,
            appliedLoopOrderFee,
            loopCartMetadata,
            checkout.cart.lineItems,
          )
        ) {
          const removeResp = await removeLoopOrderFees(
            checkout?.id,
            appliedLoopOrderFee || null,
            loopCartMetadata?.id,
            checkout.cart.lineItems,
            // checkout.version,
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
          console.log('Cart metadata set, apply order fee');
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
        console.log('ERROR initializing', error);
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
