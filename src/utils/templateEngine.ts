import { RssItem } from '../types';
import { escapeYamlValue } from './yamlFormatter';

/**
 * テンプレートの前処理
 * 画像がない場合は{{image}}を含む行を削除
 * @param template テンプレート文字列
 * @param item RSSアイテム
 * @returns 前処理されたテンプレート
 */
export function prepareTemplate(template: string, item: RssItem): string {
	let preparedTemplate = template;

	if (!item.imageUrl) {
		preparedTemplate = preparedTemplate.replace(/^.*{{image}}.*\n?/gm, '');
	}

	return preparedTemplate;
}

/**
 * テンプレート変数のデータ
 */
export interface TemplateData {
	title: string;
	link: string;
	author: string;
	publishedTime: string;
	savedTime: string;
	image: string;
	description: string;
	descriptionShort: string;
	tags: string;
	content: string;
}

/**
 * テンプレートをレンダリング
 * @param template テンプレート文字列
 * @param data テンプレートデータ
 * @returns レンダリング結果
 */
export function renderTemplate(template: string, data: TemplateData): string {
	return template
		.replace(/{{title}}/g, data.title)
		.replace(/{{link}}/g, data.link)
		.replace(/{{author}}/g, data.author)
		.replace(/{{publishedTime}}/g, data.publishedTime)
		.replace(/{{savedTime}}/g, data.savedTime)
		.replace(/{{image}}/g, data.image)
		.replace(/{{description}}/g, data.description)
		.replace(/{{descriptionShort}}/g, data.descriptionShort)
		.replace(/{{#tags}}/g, data.tags)
		.replace(/{{content}}/g, data.content);
}
