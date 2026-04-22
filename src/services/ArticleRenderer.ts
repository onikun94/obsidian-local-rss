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

	/**
	 * RSSアイテムをsingle-file modeのMarkdownセクションとして生成
	 * @param rssItem RSSアイテム
	 * @param processedContent 処理済みのHTMLコンテンツ
	 * @returns Markdownセクション文字列（--- 区切り付き）
	 */
	renderSection(rssItem: RssItem, processedContent: string): string {
		const data = this.buildTemplateData(rssItem);
		data.content = htmlToMarkdown(processedContent);

		const lines: string[] = [];
		lines.push(`## ${data.title}`, '');
		lines.push(`**Published:** ${data.publishedTime} · **Author:** ${data.author} · [Link](${data.link})`, '');

		if (data.description) {
			lines.push(`> ${data.description}`, '');
		}

		if (rssItem.imageUrl) {
			lines.push(`![](${rssItem.imageUrl})`, '');
		}

		if (data.tags) {
			lines.push(data.tags, '');
		}

		if (data.content) {
			lines.push(data.content, '');
		}

		lines.push('---', '');
		return lines.join('\n');
	}
}