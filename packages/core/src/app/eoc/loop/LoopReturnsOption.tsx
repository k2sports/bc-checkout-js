import React, {
  ChangeEvent,
  type FunctionComponent,
  memo,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Legend, LoadingOverlay } from '@bigcommerce/checkout/ui';
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

const requestSender = createRequestSender({
  // host: 'https://subconsciously-pointless-jeanne.ngrok-free.dev/api/v1/',
  host: 'https://dev-eoc-checkout-helper.onrender.com/api/v1/',
});

// todo:
// 1. check if loop is enabled in checkout settings
// 2. check if loop fee was already added
// 3. analyze cart and get quote from loop api
// 4. if quote is different than current fee, remove and uncheck?
// 5, if quote is same as current fee, check and show quote
// 6. if checked, add to order, reload checkout
// 7. if order changes, redo steps 3-6
// to do: check eligible

// other things:
// if you go back to email step and login, does it force you to redo the shipping step?

const LoopReturnsOption: FunctionComponent = () => {
  // const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  // const checkoutSettings: ManageShippingMethods | undefined =
  //   customCheckoutWindow?.checkoutConfig?.manageShippingMethods;

  const isLoopEnabled = true; //checkoutSettings?.withdrawalTermsUrl;
  const [isInitializing, setIsInitializing] = useState(false);
  const [loopQuote, setLoopQuote] = useState<LoopQuote | null>(null);
  const [loopOrderFee, setLoopOrderFee] = useState<Fee | null>(null);
  const [cartMetafieldId, setCartMetafieldId] = useState<string | null>(null);
  const [isLoopChecked, setIsLoopChecked] = useState(false);

  const {
    selectedState: { checkout },
    checkoutService,
  } = useCheckout(({ data }) => ({
    checkout: data.getCheckout(),
  }));

  const cart = checkout?.cart;

  // const legend = useMemo(
  //   () => (
  //     <Legend>
  //       {/* <TranslatedString id="shipping.order_comment_label" /> */}
  //       Returns Coverage
  //     </Legend>
  //   ),
  //   [],
  // );

  // const labelContent = useMemo(
  //   () => (
  //     <p>
  //       Free returns for{' '}
  //       <ShopperCurrency amount={centsToDollars(loopQuote?.chargeInstructions?.amount || 0)} />
  //     </p>
  //   ),
  //   [loopQuote],
  // );

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

        if (!cart || !checkout || !checkout?.id) {
          // disable loop
          return;
        }

        const loopQuoteData = await getLoopQuote(cart, checkout);
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

        if (
          appliedLoopOrderFee &&
          dollarsToCents(appliedLoopOrderFee?.cost) !== loopQuoteData?.chargeInstructions?.amount
        ) {
          console.log(
            'REMOVE loop, loop or quote dont match',
            appliedLoopOrderFee?.cost,
            loopQuoteData?.chargeInstructions?.amount,
          );
          await removeLoopOrderFees(checkout?.id, appliedLoopOrderFee, loopCartMetadata?.id);
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
      isLoopEnabled ? (
        <form>
          <LoadingOverlay isLoading={isInitializing}>
            <fieldset>
              <Legend>Returns Coverage</Legend>

              <label htmlFor="loopReturnsOption">
                <input
                  id="loopReturnsOption"
                  name="loopReturnsOption"
                  type="checkbox"
                  checked={isLoopChecked}
                  onChange={handleChange}
                />
                <p>
                  Free returns for{' '}
                  <ShopperCurrency
                    amount={centsToDollars(loopQuote?.chargeInstructions?.amount || 0)}
                  />
                </p>
              </label>
            </fieldset>
          </LoadingOverlay>
        </form>
      ) : null,
    [
      isLoopEnabled,
      isInitializing,
      loopQuote,
      loopOrderFee,
      isLoopChecked,
      cartMetafieldId,
      checkout,
    ],
  );

  return loopReturnsOption;
};

export default memo(LoopReturnsOption);
