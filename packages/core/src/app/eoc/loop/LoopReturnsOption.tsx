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
import { Fee, LineItem } from '@bigcommerce/checkout-sdk';
import { createRequestSender } from '@bigcommerce/request-sender';
import { ShopperCurrency } from '../../currency';
import { CartMetadataResp, CartMetafield } from './types';
import { removeOrderFees } from './checkoutHelpers';

const requestSender = createRequestSender({
  // host: 'https://subconsciously-pointless-jeanne.ngrok-free.dev/api/v1/',
  host: 'https://dev-eoc-checkout-helper.onrender.com/api/v1/',
});

interface LoopQuote {
  sessionId: string;
  mode: string[];
  chargeInstructions: {
    amount: number;
    currencyCode: string;
    method: string;
  };
  eligible: boolean;
}

// todo:
// 1. check if loop is enabled in checkout settings
// 2. check if loop fee was already added
// 3. analyze cart and get quote from loop api
// 4. if quote is different than current fee, remove and uncheck?
// 5, if quote is same as current fee, check and show quote
// 6. if checked, add to order, reload checkout
// 7. if order changes, redo steps 3-6

// other things:
// if you go back to email step and login, does it force you to redo the shipping step?

const LoopReturnsOption: FunctionComponent = () => {
  // const customCheckoutWindow: CustomCheckoutWindow = window as unknown as CustomCheckoutWindow;
  // const checkoutSettings: ManageShippingMethods | undefined =
  //   customCheckoutWindow?.checkoutConfig?.manageShippingMethods;

  const isLoopEnabled = true; //checkoutSettings?.withdrawalTermsUrl;
  const [isInitializing, setIsInitializing] = useState(false);
  const [loopQuote, setLoopQuote] = useState<LoopQuote | null>(null);
  const [customLoopFee, setCustomLoopFee] = useState<Fee | null>(null);
  const [cartMetafieldId, setCartMetafieldId] = useState<string | null>(null);
  const [isLoopChecked, setIsLoopChecked] = useState(false);

  const {
    selectedState: { checkout },
    checkoutService,
  } = useCheckout(({ data }) => ({
    checkout: data.getCheckout(),
  }));

  const cart = checkout?.cart;

  const dollarsToCents = (amount: number) => {
    return amount * 100;
  };

  const centsToDollars = (amount: number) => {
    return amount / 100;
  };

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
    console.log('Loop Returns Option checked::', { isChecked, loopQuote, customLoopFee });

    try {
      if (isChecked && loopQuote?.chargeInstructions?.amount) {
        // Apply custom fee to checkout
        const orderFeesResp = await requestSender.post('/checkout/bigcommerce/update-order-fees', {
          body: {
            checkoutId: checkout?.id,
            fee: {
              id: customLoopFee?.id,
              type: 'custom_fee',
              name: 'loop_return_coverage',
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
                namespace: 'loop_checkout_plus',
                key: 'loop_checkout_plus',
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
        // TODO: delete fee and cart metadata if unchecked
        console.log('TODO: delete fee and cart metadata');

        if (checkout?.id) {
          await removeOrderFees(checkout.id, customLoopFee, cartMetafieldId);
        }
        // if (cartMetafieldId) {
        //   // todo: delete metadata
        //   const cartMetadataResp: CartMetadataResp = await requestSender.delete(
        //     '/checkout/bigcommerce/delete-cart-metadata',
        //     {
        //       body: {
        //         checkoutId: checkout?.id,
        //         metafield: {
        //           id: cartMetafieldId,
        //         },
        //       },
        //     },
        //   );
        //   console.log('clear cart metafield', cartMetadataResp);
        setCartMetafieldId(null);
        // }

        // if (customLoopFee) {
        //   const orderFeesResp = await requestSender.delete(
        //     '/checkout/bigcommerce/delete-order-fees',
        //     {
        //       body: {
        //         checkoutId: checkout?.id,
        //         fee: {
        //           id: customLoopFee?.id,
        //         },
        //       },
        //     },
        //   );
        //   console.log('clear order fee', orderFeesResp);
        setCustomLoopFee(null);
        // }
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

        const currencyCode = cart?.currency.code;
        const allItems = Object.values(cart?.lineItems || {}).flat();
        const cartItems = allItems?.map((item: LineItem) => ({
          id: item.id,
          productId: String(item.productId),
          quantity: item.quantity,
          unitPrice: {
            amount: dollarsToCents(item.listPrice),
            currencyCode: currencyCode,
          },
          totalPrice: {
            amount: dollarsToCents(item.extendedSalePrice),
            currencyCode: currencyCode,
          },
          originalTotalPrice: {
            amount: dollarsToCents(item.extendedListPrice),
            currencyCode: currencyCode,
          },
          title: item.name,
        }));

        const reqBody = {
          platform: 'bigcommerce',
          region: 'US',
          cartId: cart?.id,
          cart: {
            lines: cartItems,
            itemCount: cartItems?.length
              ? cartItems.reduce((acc, item) => acc + item.quantity, 0)
              : 0,
            subtotalAmount: dollarsToCents(checkout?.subtotal || 0),
            totalDiscountAmount: dollarsToCents(checkout?.totalDiscount || 0),
            discountedSubtotalAmount: dollarsToCents(checkout?.subtotal || 0),
            totalTaxAmount: dollarsToCents(checkout?.taxTotal || 0),
            totalAmount: dollarsToCents(checkout?.grandTotal || 0),
            currencyCode: currencyCode,
          },
        };

        // Get loop coverage options based on cart
        const data = await requestSender.post('/checkout/loop/analyze', {
          body: reqBody,
        });
        setLoopQuote(data.body as LoopQuote);

        // Get cart metadata
        const cartMetadataResp = await requestSender.post(
          `/checkout/bigcommerce/cart-metadata/${checkout?.id}/loop_checkout_plus`,
        );
        const loopCartMetadata = cartMetadataResp?.body as CartMetafield;
        setCartMetafieldId(loopCartMetadata?.id);

        // Get & set loop fee if it's been applied
        const currentCustomLoopFee = checkout?.fees?.find(
          (fee) => fee.name === 'loop_return_coverage',
        );
        setCustomLoopFee(currentCustomLoopFee || null);
        setIsLoopChecked(currentCustomLoopFee ? true : false);
      } catch (error) {
        // hide loop
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
    [isLoopEnabled, isInitializing, loopQuote, customLoopFee, isLoopChecked, cartMetafieldId],
  );

  return loopReturnsOption;
};

export default memo(LoopReturnsOption);
