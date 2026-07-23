import React, {
  ChangeEvent,
  type FunctionComponent,
  memo,
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
  getLoopQuote,
  LOOP_NAMESPACE,
  removeLoopOrderFees,
} from './checkoutHelpers';
import { CustomCheckoutWindow, ManageShippingMethods } from '../../auto-loader';
import './LoopReturnsOption.scss';
import IconInfo from '@bigcommerce/checkout/ui/icon/IconInfo';

const requestSender = createRequestSender({
  // host: 'https://subconsciously-pointless-jeanne.ngrok-free.dev/api/v1/',
  host: 'https://dev-eoc-checkout-helper.onrender.com/api/v1/',
});

// todo:
// 1. check if loop is enabled in checkout settings
// 2. check if loop fee was already added
// 3. analyze cart and get quote from loop api
// 4. if quote is different than current fee, remove fee and uncheck
// 4. if quote is not eligible, remove fee and hide checkbox
// 5, if quote is same as current fee, check and show quote
// 6. if checked, add to order, reload checkout
// 7. if order changes, redo steps 3-6

// other things:
// if you go back to email step and login, does it force you to redo the shipping step?

const LoopReturnsOption: FunctionComponent = () => {
  const [checkoutSettings, setCheckoutSettings] = useState<ManageShippingMethods | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loopQuote, setLoopQuote] = useState<LoopQuote | null>(null);
  const [loopOrderFee, setLoopOrderFee] = useState<Fee | null>(null);
  const [cartMetafieldId, setCartMetafieldId] = useState<string | null>(null);
  const [isLoopChecked, setIsLoopChecked] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const {
    selectedState: { checkout },
    checkoutService,
  } = useCheckout(({ data }) => ({
    checkout: data.getCheckout(),
  }));

  const onRequestClose = () => {
    setIsInfoModalOpen((prevState) => !prevState);
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const isChecked = event.target.checked;
    setIsLoopChecked(isChecked);
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
              display_name: 'Returns Coverage',
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
      } else {
        // Delete fee and cart metadata if unchecked
        if (checkout?.id) {
          console.log('DELETE, unchecked option');
          await removeLoopOrderFees(checkout.id, loopOrderFee, cartMetafieldId);
        }
        setCartMetafieldId(null);
        setLoopOrderFee(null);
      }
    } catch (error) {
      console.error('Error sending data to BC API:', error);
    } finally {
      checkoutService.loadCheckout();
    }
  };

  useEffect(() => {
    const initializeLoop = async () => {
      console.log('Loop Returns Option component mounted');
      try {
        setIsInitializing(false);
        const customCheckoutWindow: CustomCheckoutWindow =
          window as unknown as CustomCheckoutWindow;
        const checkoutSettings: ManageShippingMethods | undefined =
          customCheckoutWindow?.checkoutConfig?.manageShippingMethods;
        setCheckoutSettings(checkoutSettings || null);
        console.log('checkoutSettings', checkoutSettings);

        if (!checkout || !checkout?.cart || !checkout?.id || !checkoutSettings?.enableLoop) {
          // disable loop
          return;
        }

        const loopQuoteData = await getLoopQuote(checkout.cart, checkout);
        setLoopQuote(loopQuoteData);

        // Get cart metadata
        const cartMetadataResp = await requestSender.post(
          `/checkout/bigcommerce/cart-metadata/${checkout?.id}/${LOOP_NAMESPACE}`,
        );
        const loopCartMetadata = cartMetadataResp?.body as CartMetafield;
        console.log('loopCartMetadata', loopCartMetadata);

        // Get & set loop fee if it's been applied
        console.log('HMMM checkout', checkout);
        const appliedLoopOrderFee = checkout?.fees?.find((fee) => fee.name === LOOP_NAMESPACE);
        console.log('appliedLoopOrderFee', appliedLoopOrderFee);

        // If order isn't eligible for Loop or quote changed then remove order fee and cart metadata
        if (
          !loopQuoteData.eligible ||
          (appliedLoopOrderFee &&
            dollarsToCents(appliedLoopOrderFee?.cost) !== loopQuoteData?.chargeInstructions?.amount)
        ) {
          console.log(
            'REMOVE loop, loop or quote dont match',
            appliedLoopOrderFee?.cost,
            loopQuoteData?.chargeInstructions?.amount,
          );
          await removeLoopOrderFees(
            checkout?.id,
            appliedLoopOrderFee || null,
            loopCartMetadata?.id,
          );
          setLoopOrderFee(null);
          setIsLoopChecked(false);
          setCartMetafieldId(null);
          checkoutService.loadCheckout();
        } else {
          setLoopOrderFee(appliedLoopOrderFee || null);
          setIsLoopChecked(appliedLoopOrderFee ? true : false);
          setCartMetafieldId(loopCartMetadata?.id || null);
        }
      } catch (error) {
        // hide loop
        console.log('ERROR initializing', error);
      } finally {
        setIsInitializing(false);
      }
    };

    void initializeLoop();
  }, []);

  const loopReturnsOption = useMemo(
    () =>
      checkoutSettings?.enableLoop ? (
        <>
          <form className="loop-returns-option-form">
            <LoadingOverlay isLoading={isInitializing}>
              <fieldset>
                <div className="loop-legend">
                  <Legend>{checkoutSettings?.loopFormTitle || 'Returns Coverage'}</Legend>
                  <Button
                    variant={ButtonVariant.Secondary}
                    size={ButtonSize.Tiny}
                    onClick={onRequestClose}
                  >
                    <IconInfo />
                  </Button>
                </div>
                {loopQuote?.eligible ? (
                  <div className="form-body">
                    <div className="form-field">
                      <input
                        id="loopReturnsOption"
                        name="loopReturnsOption"
                        type="checkbox"
                        checked={isLoopChecked}
                        onChange={handleChange}
                        className="form-checkbox optimizedCheckout-form-checkbox 
                    floating-form-field-input"
                      />
                      <label
                        htmlFor="loopReturnsOption"
                        className="form-label optimizedCheckout-form-label body-regular"
                      >
                        <span className="body-regular">
                          {checkoutSettings?.loopFieldLabel || 'Free returns for '}
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
              <ModalHeader>{checkoutSettings?.loopFormTitle || 'Returns Coverage'}</ModalHeader>
            }
            isOpen={isInfoModalOpen}
            onRequestClose={onRequestClose}
            shouldShowCloseButton={true}
          >
            {checkoutSettings?.loopModalText}
          </Modal>
        </>
      ) : null,
    [
      checkoutSettings,
      isInitializing,
      loopQuote,
      loopOrderFee,
      isLoopChecked,
      cartMetafieldId,
      checkout,
      isInfoModalOpen,
    ],
  );

  return loopReturnsOption;
};

export default memo(LoopReturnsOption);
