import type { Tone } from "./family-stats";

type Vars = { parent: string; kids: string; centre: string; tutor: string; amount: string; months: string; days: number; by: string; link: string };

const T: Record<string, Record<Tone, (v: Vars) => string>> = {
  en: {
    GENTLE: (v) =>
      `Namaste ${v.parent} garu, a gentle reminder from ${v.centre}: ${v.kids}'s tuition fee of ${v.amount} for ${v.months} is pending. You can pay by UPI here: ${v.link}\nThank you! – ${v.tutor}`,
    FIRM: (v) =>
      `Namaste ${v.parent} garu, ${v.kids}'s tuition fee of ${v.amount} for ${v.months} is now ${v.days} days overdue. Please clear it by ${v.by}. Pay by UPI: ${v.link}\n– ${v.tutor}, ${v.centre}`,
    FINAL: (v) =>
      `Namaste ${v.parent} garu, this is a final reminder: ${v.amount} for ${v.months} is ${v.days} days overdue and the earlier payment dates were missed. Please pay by ${v.by} so ${v.kids}'s classes continue without interruption. Pay: ${v.link}\n– ${v.tutor}, ${v.centre}`,
  },
  te: {
    GENTLE: (v) =>
      `నమస్కారం ${v.parent} గారు, ${v.centre} నుండి చిన్న గుర్తు: ${v.kids} యొక్క ${v.months} ట్యూషన్ ఫీజు ${v.amount} ఇంకా చెల్లించాల్సి ఉంది. UPI ద్వారా ఇక్కడ చెల్లించవచ్చు: ${v.link}\nధన్యవాదాలు! – ${v.tutor}`,
    FIRM: (v) =>
      `నమస్కారం ${v.parent} గారు, ${v.kids} యొక్క ${v.months} ట్యూషన్ ఫీజు ${v.amount} గడువు దాటి ${v.days} రోజులు అయింది. దయచేసి ${v.by} లోపు చెల్లించండి. UPI లింక్: ${v.link}\n– ${v.tutor}, ${v.centre}`,
    FINAL: (v) =>
      `నమస్కారం ${v.parent} గారు, ఇది చివరి గుర్తు: ${v.months} ఫీజు ${v.amount} గడువు దాటి ${v.days} రోజులు అయింది, ఇచ్చిన తేదీలు కూడా దాటిపోయాయి. ${v.kids} క్లాసులు ఆగకుండా ఉండాలంటే దయచేసి ${v.by} లోపు చెల్లించండి. లింక్: ${v.link}\n– ${v.tutor}, ${v.centre}`,
  },
  hi: {
    GENTLE: (v) =>
      `नमस्ते ${v.parent} जी, ${v.centre} की ओर से एक छोटा सा रिमाइंडर: ${v.kids} की ${v.months} की ट्यूशन फीस ${v.amount} बाकी है। आप UPI से यहाँ भुगतान कर सकते हैं: ${v.link}\nधन्यवाद! – ${v.tutor}`,
    FIRM: (v) =>
      `नमस्ते ${v.parent} जी, ${v.kids} की ${v.months} की ट्यूशन फीस ${v.amount} अब ${v.days} दिन से बाकी है। कृपया ${v.by} तक भुगतान करें। UPI लिंक: ${v.link}\n– ${v.tutor}, ${v.centre}`,
    FINAL: (v) =>
      `नमस्ते ${v.parent} जी, यह अंतिम रिमाइंडर है: ${v.months} की फीस ${v.amount} ${v.days} दिन से बाकी है और पिछली तारीखें भी निकल गई हैं। ${v.kids} की क्लास बिना रुकावट चलती रहे, इसके लिए कृपया ${v.by} तक भुगतान करें। लिंक: ${v.link}\n– ${v.tutor}, ${v.centre}`,
  },
};

export function reminderText(language: string, tone: Tone, v: Vars): string {
  const lang = T[language] ? language : "en";
  return T[lang][tone](v);
}

export function discountOfferText(language: string, v: { parent: string; kids: string; month: string; amount: string; discount: string; by: string; link: string; tutor: string }): string {
  if (language === "te")
    return `నమస్కారం ${v.parent} గారు, ${v.kids} యొక్క ${v.month} ఫీజు ${v.by} లోపు చెల్లిస్తే ${v.discount} తగ్గింపు. చెల్లించాల్సింది ${v.amount} మాత్రమే: ${v.link}\n– ${v.tutor}`;
  if (language === "hi")
    return `नमस्ते ${v.parent} जी, ${v.kids} की ${v.month} की फीस ${v.by} तक जमा करने पर ${v.discount} की छूट। केवल ${v.amount} देने हैं: ${v.link}\n– ${v.tutor}`;
  return `Namaste ${v.parent} garu, pay ${v.kids}'s ${v.month} fee by ${v.by} and get ${v.discount} off. Just ${v.amount} to pay: ${v.link}\n– ${v.tutor}`;
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function kidsLabel(names: string[]): string {
  const first = names.map((n) => n.split(" ")[0]);
  if (first.length <= 1) return first[0] ?? "";
  return `${first.slice(0, -1).join(", ")} & ${first[first.length - 1]}`;
}
