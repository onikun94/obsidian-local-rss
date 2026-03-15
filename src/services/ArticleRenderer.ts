import { RssItem } from '../types';
import { XmlNormalizer } from '../adapters/parsers/XmlNormalizer';
import { escapeYamlValue } from '../utils/yamlFormatter';
import { htmlToMarkdown } from '../utils/htmlProcessor';
import { prepareTemplate, renderTemplate, TemplateData } from '../utils/templateEngine';
import { formatDateTime } from '../utils/dateFormatter';

/**
 * 記事レンダリングサービス
 * RssItemとテンプレートからMarkdownファイルの内容を生成する
 */
export class ArticleRenderer {
	/**
	 * テンプレートデータを構築
	 * @param rssItem RSSアイテム
	 * @returns テンプレートに渡すデータ
	 */
	buildTemplateData(rssItem: RssItem): TemplateData {
		const pubDate = new Date(rssItem.pubDate);
		const savedDate = new Date(rssItem.savedDate);

		const escapedTitle = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.title));
		const escapedAuthor = escapeYamlValue(XmlNormalizer.normalizeValue(rssItem.author));

		const descriptionCleaned = rssItem.description.replace(/\r?\n/g, ' ').trim();
		const descriptionShort = descriptionCleaned.substring(0, 50) + (descriptionCleaned.length > 50 ? '...' : '');
		const escapedDescription = escapeYamlValue(descriptionCleaned);
		const escapedDescriptionShort = escapeYamlValue(descriptionShort);

		return {
			title: escapedTitle,
			link: rssItem.link,
			author: escapedAuthor,
			publishedTime: formatDateTime(pubDate),
			savedTime: formatDateTime(savedDate),
			publishedDate: pubDate,
			savedDate: savedDate,
			image: rssItem.imageUrl,
			description: escapedDescription,
			descriptionShort: escapedDescriptionShort,
			tags: rssItem.categories.map(c => `#${c}`).join(' '),
			content: '', // contentは別途処理
		};
	}

	/**
	 * RSSアイテムとテンプレートからMarkdownコンテンツを生成
	 * @param rssItem RSSアイテム
	 * @param template テンプレート文字列
	 * @param processedContent 処理済みのHTMLコンテンツ
	 * @returns Markdownファイルの内容
	 */
	render(rssItem: RssItem, template: string, processedContent: string): string {
		const preparedTemplate = prepareTemplate(template, rssItem);
		const templateData = this.buildTemplateData(rssItem);
		templateData.content = htmlToMarkdown(processedContent);
		return renderTemplate(preparedTemplate, templateData);
	}
}
