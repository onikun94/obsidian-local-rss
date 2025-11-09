import { moment } from 'obsidian';
import en from './locales/en';
import ja from './locales/ja';

const localeMap: { [key: string]: Partial<typeof en> } = {
    en,
    ja,
    'ja-JP': ja
};

export function t(localizationId: keyof typeof en, ...inserts: string[]): string {
    // Obsidianの言語設定を取得（localStorageからも試す）
    const lang = moment.locale() || window.localStorage.getItem('language') || 'en';
    const userLocale = localeMap[lang] || localeMap[lang.split('-')[0]] || localeMap['en'];
    let localeStr = userLocale?.[localizationId] ?? en[localizationId] ?? localizationId;
    
    // Replace placeholders with inserts
    localeStr = localeStr.replace(/%(\d+)/g, (_: string, indexStr: string) => {
        const index = parseInt(indexStr, 10);
        return inserts[index] ?? '';
    });

    return localeStr;
}
