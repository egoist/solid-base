import { Repeat, createUniqueId } from 'solid-js';
import { OTPField } from '@egoist/solid-base/otp-field';
import styles from './grouped.module.css';

const CODE_LENGTH = 6;

export default function OTPFieldGroupedDemo() {
  const id = createUniqueId();

  return (
    <div class={styles.Field}>
      <label for={id} class={styles.Label}>
        Verification code
      </label>
      <OTPField.Root id={id} length={CODE_LENGTH} class={styles.Root}>
        <div class={styles.Group}>
          <Repeat count={3}>
            {(index) => (
              <OTPField.Input
                class={styles.Input}
                aria-label={index === 0 ? undefined : `Character ${index + 1} of ${CODE_LENGTH}`}
              />
            )}
          </Repeat>
        </div>
        <OTPField.Separator class={styles.Separator} />
        <div class={styles.Group}>
          <Repeat count={3}>
            {(index) => (
              <OTPField.Input
                class={styles.Input}
                aria-label={`Character ${index + 4} of ${CODE_LENGTH}`}
              />
            )}
          </Repeat>
        </div>
      </OTPField.Root>
    </div>
  );
}
