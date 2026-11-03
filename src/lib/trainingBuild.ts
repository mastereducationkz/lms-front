/** True only in the training copy's build (`vite build --mode training`, .env.training): the stand where new hires practise. */
export const TRAINING_BUILD = import.meta.env.VITE_APP_ENV === 'training';
