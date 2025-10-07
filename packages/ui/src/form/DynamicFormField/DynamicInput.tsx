import { type FormFieldItem } from '@bigcommerce/checkout-sdk';
import classNames from 'classnames';
import { isDate, noop } from 'lodash';
import React, { type FunctionComponent, lazy, memo, Suspense, useCallback } from 'react';

import { withDate, type WithDateProps } from '@bigcommerce/checkout/locale';

import { IconChevronDown } from '../../icon';
import { CheckboxInput } from '../CheckboxInput';
import { type InputProps } from '../Input';
import { RadioInput } from '../RadioInput';
import { TextArea } from '../TextArea';
import { TextInput } from '../TextInput';

import DynamicFormFieldType from './DynamicFormFieldType';

const ReactDatePicker = lazy(
    () =>
        import(
            /* webpackChunkName: "react-datepicker" */
            'react-datepicker'
        ),
);

export interface DynamicInputProps extends InputProps {
    id: string;
    additionalClassName?: string;
    value?: string | string[];
    rows?: number;
    fieldType?: DynamicFormFieldType;
    options?: FormFieldItem[];
    isFloatingLabelEnabled?: boolean;
    themeV2?: boolean;
    inputDateFormat?: string;
}

const DynamicInput: FunctionComponent<DynamicInputProps & WithDateProps> = ({
    fieldType,
    id,
    name,
    onChange = noop,
    options,
    placeholder,
    value,
    isFloatingLabelEnabled,
    themeV2 = false,
    date,
    inputDateFormat,
    ...rest
}) => {
    const inputFormat = inputDateFormat || date.inputFormat || '';

    const handleDateChange = useCallback(
        (dateValue: string, event: any) =>
            onChange({
                ...event,
                target: {
                    name,
                    value: dateValue,
                },
            }),
        [onChange, name],
    );

    switch (fieldType) {
        case DynamicFormFieldType.DROPDOWM:
            return (
                <>
                    <div
                        className={classNames(
                            { 'dropdown-chevron': !isFloatingLabelEnabled },
                            { 'floating-select-chevron': isFloatingLabelEnabled },
                        )}
                    >
                        <IconChevronDown />
                    </div>
                    <select
                        {...(rest as any)}
                        className={classNames(
                            { 'floating-select': isFloatingLabelEnabled },
                            'form-select optimizedCheckout-form-select',
                            { 'floating-form-field-input': themeV2 },
                        )}
                        data-test={`${id}-select`}
                        id={id}
                        name={name}
                        onChange={onChange}
                        value={value ?? ''}
                    >
                        {!!placeholder && <option value="">{placeholder}</option>}
                        {options &&
                            options.map(({ label, value: optionValue }) => (
                                <option key={optionValue} value={optionValue}>
                                    {label}
                                </option>
                            ))}
                    </select>
                </>
            );

        case DynamicFormFieldType.RADIO:
            if (!options || !options.length) {
                return null;
            }

            return (
                <>
                    {options.map(({ label, value: optionValue }) => (
                        <RadioInput
                            {...rest}
                            checked={optionValue === value}
                            id={`${id}-${optionValue}`}
                            key={optionValue}
                            label={label}
                            name={name}
                            onChange={onChange}
                            testId={`${id}-${optionValue}-radio`}
                            themeV2={themeV2}
                            value={optionValue}
                        />
                    ))}
                </>
            );

        case DynamicFormFieldType.CHECKBOX:
            if (!options || !options.length) {
                return null;
            }

            return (
                <>
                    {options.map(({ label, value: optionValue }) => (
                        <CheckboxInput
                            {...rest}
                            checked={Array.isArray(value) ? value.includes(optionValue) : false}
                            id={`${id}-${optionValue}`}
                            key={optionValue}
                            label={label}
                            name={name}
                            onChange={onChange}
                            testId={`${id}-${optionValue}-checkbox`}
                            themeV2={themeV2}
                            value={optionValue}
                        />
                    ))}
                </>
            );

        case DynamicFormFieldType.DATE:
            return (
                <Suspense>
                    <ReactDatePicker
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        {...(rest as any)}
                        autoComplete="off"
                        // FIXME: we can avoid this by simply using onChangeRaw, but it's not being triggered properly
                        // https://github.com/Hacker0x01/react-datepicker/issues/1357
                        // onChangeRaw={ rest.onChange }
                        calendarClassName="optimizedCheckout-contentPrimary"
                        className={classNames('form-input optimizedCheckout-form-input', {
                            'floating-input': isFloatingLabelEnabled,
                            'floating-form-field-input': themeV2,
                        })}
                        dateFormat={inputFormat}
                        maxDate={rest.max ? new Date(`${rest.max}T00:00:00Z`) : undefined}
                        minDate={rest.min ? new Date(`${rest.min}T00:00:00Z`) : undefined}
                        name={name}
                        onChange={handleDateChange}
                        placeholderText={inputFormat.toUpperCase()}
                        popperClassName="optimizedCheckout-contentPrimary"
                        selected={isDate(value) ? value : undefined}
                    />
                </Suspense>
            );

        case DynamicFormFieldType.MULTILINE:
            return (
                <TextArea
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...(rest as any)}
                    id={id}
                    isFloatingLabelEnabled={isFloatingLabelEnabled}
                    name={name}
                    onChange={onChange}
                    testId={`${id}-text`}
                    themeV2={themeV2}
                    type={fieldType}
                    value={value}
                />
            );

        default:
            return (
                <TextInput
                    {...rest}
                    id={id}
                    isFloatingLabelEnabled={isFloatingLabelEnabled}
                    name={name}
                    onChange={onChange}
                    placeholder={placeholder}
                    testId={`${id}-${
                        fieldType === DynamicFormFieldType.PASSWORD ? 'password' : 'text'
                    }`}
                    themeV2={themeV2}
                    type={fieldType}
                    value={value}
                />
            );
    }
};

export default memo(withDate(DynamicInput));
