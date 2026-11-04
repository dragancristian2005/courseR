import { Linking } from "react-native";
import { isSafeLinkUrl } from "../domain/links";

/** Opens a link only when its scheme is http, https or mailto; otherwise does nothing. */
export function openLink(url: string): void {
  if (isSafeLinkUrl(url)) void Linking.openURL(url.trim());
}
