// for simplicity, instead of json file x-en.json
import {XLocaleOptions} from "../services/XLocale";

export const localeEn: {"en": XLocaleOptions} =
{
  "en": {
    "pessimisticLockFailedLockPresent": "The pessimistic lock failed - (probably) user {lockUser} took over the lock (from {lockDate}) and is editing the row right now. Sorry, you have to cancel the editation and start the editation again.",
    "pessimisticLockFailedLockFinished": "The pessimistic lock failed - someone took over the lock and saved the row. The row was last modified by user {modifUser} at {modifDate}. Sorry, you have to cancel the editation and start the editation again.",
  }
}
