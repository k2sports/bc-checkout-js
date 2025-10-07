import { type LanguageService } from '@bigcommerce/checkout-sdk';
import { object, type ObjectSchema, string, type StringSchema } from 'yup';

import { type PaymentFormValues } from '@bigcommerce/checkout/payment-integration-api';

import { getTermsConditionsValidationSchema } from '../termsConditions';

export interface PaymentValidationSchemaOptions {
    additionalValidation?: ObjectSchema<Partial<PaymentFormValues>>;
    isTermsConditionsRequired: boolean;
    language: LanguageService;
}

export default function getPaymentValidationSchema({
    additionalValidation,
    isTermsConditionsRequired,
    language,
}: PaymentValidationSchemaOptions): ObjectSchema<PaymentFormValues> {
    const schemaFields: {
        paymentProviderRadio: StringSchema;
    } = {
        paymentProviderRadio: string().required(),
    };

    const schemaFieldsWithTerms = object(schemaFields).concat(
        getTermsConditionsValidationSchema({ isTermsConditionsRequired, language }),
    );

    return additionalValidation
        ? schemaFieldsWithTerms.concat(additionalValidation as any)
        : schemaFieldsWithTerms;
}
