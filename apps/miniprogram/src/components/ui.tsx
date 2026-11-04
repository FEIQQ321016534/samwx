import React from 'react';
import Taro from '@tarojs/taro';
import { View as NativeView, Text as NativeText, Button as NativeButton, Input as NativeInput, Textarea as NativeTextarea, Form as NativeForm, Picker } from '@tarojs/components';
export const View: any = NativeView;
export const Text: any = NativeText;
const FormSubmit = React.createContext<any>(null);
export const Button = ({ children, type, onClick, ...props }: any) => {
  const submit = React.useContext(FormSubmit);
  const browserSubmit = process.env.TARO_ENV === 'h5' && type === 'submit';
  return <NativeButton {...props} formType={type === 'submit' && !browserSubmit ? 'submit' : undefined} onClick={(event) => {
    onClick?.(event);
    if (browserSubmit) submit?.({ ...event, preventDefault() {} });
  }}>{children}</NativeButton>;
};
export const Input = ({ onChange, type, required, className = '', ...props }: any) => {
  // Native inputs have a fixed default height. With border-box + vertical
  // padding the text area can collapse on iOS. CSS reserves the whole box
  // height and centers text without native vertical padding.
  const padded = /(?:^|\s)(?:p|py)-3(?:\s|$)/.test(className) ? 'input-tall-p3'
    : /(?:^|\s)(?:p|py)-2(?:\s|$)/.test(className) ? 'input-tall-p2' : '';
  return <NativeInput {...props} className={`native-input-control ${padded} ${className}`} type={type === 'tel' ? 'number' : type || 'text'} onInput={(e) => onChange?.({ ...e, target: { value: e.detail.value } })} />;
};
export const Textarea = ({ onChange, required, ...props }: any) => <NativeTextarea {...props} onInput={(e) => onChange?.({ ...e, target: { value: e.detail.value } })} />;
export const Form = ({ onSubmit, children, ...props }: any) => <FormSubmit.Provider value={onSubmit}><NativeForm {...props} onSubmit={(e) => onSubmit?.({ ...e, preventDefault() {} })}>{children}</NativeForm></FormSubmit.Provider>;
export const Select = ({ children, value, onChange, ...props }: any) => {
  const options = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<any>[];
  const range = options.map((o) => String(o.props.children instanceof Array ? o.props.children.join('') : o.props.children));
  const selected = Math.max(0, options.findIndex((o) => o.props.value === value));
  return <Picker range={range} value={selected} onChange={(e) => onChange?.({ target: { value: options[Number(e.detail.value)]?.props.value } })}><View {...props}>{range[selected]} ▾</View></Picker>;
};
export const Option = ({ children }: any) => <>{children}</>;
export const clipboard = { writeText: (data: string) => Taro.setClipboardData({ data }) };
