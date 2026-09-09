/**
 * Prag desktop rasporeda — JEDNO mesto istine za JavaScript.
 *
 * Mora se poklapati sa `--breakpoint-lg` u styles/tailwind.css i sa media query-jima u styles/main.scss.
 * Ako se raziđu, kontroleri i raspored počnu da misle različito o tome šta je „desktop": meni bi se
 * ponašao kao na mobilnom dok CSS crta desktop, expand view bi se montirao tamo gde ga nema, i tako dalje.
 *
 * 1200, a ne 1024: desktop kompozicija potroši 240 + 540 + 16 = 796px pre nego što tekstualna kolona
 * počne. Na 1024 ostane 226px (~31 znak u redu), na 1080 282px (~39). Tek od ~1196 kolona stigne do
 * ~55 znakova, što je unutar udobnog opsega. Ispod toga se koristi tablet raspored — jedna kolona.
 */
export const DESKTOP = '(min-width: 1200px)';
export const BELOW_DESKTOP = '(max-width: 1199px)';
