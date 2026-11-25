import { Repeat, createUniqueId } from 'solid-js';
import { OTPField } from '@egoist/solid-base/otp-field';
import styles from './password.module.css';

const CODE_LENGTH = 6;

export default function OTPFieldPasswordDemo() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;

  return (
    <div class={styles.Field}>
      <label for={id} class={styles.Label}>
        Access code
      </label>
      <OTPField.Root
        id={id}
        length={CODE_LENGTH}
        mask
        aria-describedby={descriptionId}
        class={styles.Root}
      >
        <Repeat count={CODE_LENGTH}>
          {(index) => (
            <OTPField.Input
              class={styles.Input}
              aria-label={index === 0 ? undefined : `Character ${index + 1} of ${CODE_LENGTH}`}
            />
          )}
        </Repeat>
      </OTPField.Root>
      <p id={descriptionId} class={styles.Description}>
        Use <span class={styles.Code}>mask</span> to obscure the code on shared screens.
      </p>
    </div>
  );
}
