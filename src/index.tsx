import {
  type Value,
  type Format,
  SlottedTag,
  slottedStyles,
  partitionParts,
  NumberFlowLite,
  prefersReducedMotion,
  canAnimate as _canAnimate,
} from 'number-flow';
import { JSX } from 'solid-js/jsx-runtime';
import { createEffect, createMemo, createSignal, onMount, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
export type { Value, Format, Trend } from 'number-flow';

// Can't wait to not have to do this in React 19:
const OBSERVED_ATTRIBUTES = ['parts'] as const;
type ObservedAttribute = (typeof OBSERVED_ATTRIBUTES)[number];
export class NumberFlowElement extends NumberFlowLite {
  static observedAttributes = OBSERVED_ATTRIBUTES;
  attributeChangedCallback(attr: ObservedAttribute, _oldValue: string, newValue: string) {
    this[attr] = JSON.parse(newValue);
  }
}

export type NumberFlowProps = JSX.HTMLAttributes<NumberFlowElement> & {
  value: Value;
  locales?: Intl.LocalesArgument;
  format?: Format;
  isolate?: boolean;
  animated?: boolean;
  respectMotionPreference?: boolean;
  willChange?: boolean;
  // animateDependencies?: React.DependencyList
  onAnimationsStart?: () => void;
  onAnimationsFinish?: () => void;
  trend?: (typeof NumberFlowElement)['prototype']['trend'];
  opacityTiming?: (typeof NumberFlowElement)['prototype']['opacityTiming'];
  transformTiming?: (typeof NumberFlowElement)['prototype']['transformTiming'];
  spinTiming?: (typeof NumberFlowElement)['prototype']['spinTiming'];
};

// You're supposed to cache these between uses:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString
// Serialize to strings b/c React:
const formatters: Record<string, Intl.NumberFormat> = {};

export default function NumberFlow(props: NumberFlowProps) {
  onMount(() => {
    NumberFlowElement.define();
  });

  const localesString = createMemo(
    () => (props.locales ? JSON.stringify(props.locales) : ''),
    [props.locales],
  );
  const formatString = createMemo(() => (props.format ? JSON.stringify(props.format) : ''));
  const parts = createMemo(() => {
    const formatter = (formatters[`${localesString}:${formatString}`] ??= new Intl.NumberFormat(
      props.locales,
      props.format,
    ));

    return partitionParts(props.value, formatter);
  });

  const [_used, others] = splitProps(props, [
    // For Root
    'value',
    'locales',
    'format',
    // For impl
    'class',
    'willChange',
    'animated',
    'respectMotionPreference',
    'isolate',
    'trend',
    'opacityTiming',
    'transformTiming',
    'spinTiming',
  ]);

  onMount(() => {
    // This is a workaround until this gets fixed: https://github.com/solidjs/solid/issues/2339
    const el = props.ref as unknown as HTMLElement;
    const _parts = el.getAttribute('attr:parts');
    if (_parts) {
      el.removeAttribute('attr:parts');
      el.setAttribute('parts', _parts);
    }
  });

  return (
    <Dynamic
      ref={props.ref}
      component={'number-flow'}
      class={props.class}
      //   https://docs.solidjs.com/reference/jsx-attributes/attr
      attr:data-will-change={props.willChange ? '' : undefined}
      {...others}
      attr:parts={JSON.stringify(parts())}
    >
      <Dynamic component={SlottedTag} style={slottedStyles({ willChange: props.willChange })}>
        {parts().formatted}
      </Dynamic>
    </Dynamic>
  );
}

// SSR-safe canAnimate
/** Unfinished and untested. */
export function useCanAnimate(
  props: { respectMotionPreference: boolean } = { respectMotionPreference: true },
) {
  const [canAnimate, setCanAnimate] = createSignal(_canAnimate);
  const [reducedMotion, setReducedMotion] = createSignal(false);

  // Handle SSR:
  onMount(() => {
    setCanAnimate(_canAnimate);
    setReducedMotion(prefersReducedMotion?.matches ?? false);
  });

  // Listen for reduced motion changes if needed:
  createEffect(() => {
    if (!props.respectMotionPreference) return;
    const onChange = ({ matches }: MediaQueryListEvent) => {
      setReducedMotion(matches);
    };
    prefersReducedMotion?.addEventListener('change', onChange);
    return () => {
      prefersReducedMotion?.removeEventListener('change', onChange);
    };
  });

  return createMemo<boolean>(() => {
    return canAnimate() && (!props.respectMotionPreference || !reducedMotion);
  });
}
