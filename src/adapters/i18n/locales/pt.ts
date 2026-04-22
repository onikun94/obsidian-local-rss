export default {
	// Commands
	updateRssFeeds: 'Atualizar feeds RSS',
	addRssFeed: 'Adicionar feed RSS',

	// Notices
	updatingRssFeeds: 'Atualizando feeds RSS...',
	failedToFetchFeed: 'Falha ao buscar feed: %0',
	unsupportedFeedFormat: 'Formato de feed não suportado: %0',
	updatedFeed: 'Feed atualizado: %0',
	errorUpdatingFeed: 'Erro ao atualizar feed: %0',
	rssFeedUpdateCompleted: 'Atualização dos feeds RSS concluída',
	feedNameRequired: 'O nome do feed é obrigatório',
	feedUrlRequired: 'A URL do feed é obrigatória',
	addedFeed: 'Feed adicionado: %0',

	// Settings
	rssFolder: 'Pasta RSS',
	rssFolderDesc: 'Pasta onde os artigos RSS serão salvos',
	singleFilePerFeed: 'Um arquivo por feed',
	singleFilePerFeedDesc: 'Em vez de criar um arquivo por artigo, cria um único arquivo Markdown por feed com todos os artigos como seções. Novos artigos são adicionados ao topo.',
	fileNameTemplate: 'Template do nome do arquivo',
	fileNameTemplateDesc: 'Template para o nome dos arquivos de artigos. Variáveis {{title}} e {{published}} disponíveis',
	contentTemplate: 'Template de conteúdo',
	contentTemplateDesc: 'Template para o conteúdo dos artigos com front matter',
	availableVariables: 'Variáveis disponíveis',
	varTitle: 'Título do artigo',
	varLink: 'URL do artigo original',
	varAuthor: 'Nome do autor do artigo',
	varPublishedTime: 'Data e hora de publicação',
	varSavedTime: 'Data e hora em que foi salvo',
	varImage: 'URL da imagem do artigo',
	varDescription: 'Descrição completa do artigo',
	varDescriptionShort: 'Descrição (resumida)',
	varContent: 'Conteúdo completo do artigo',
	varTags: 'Categorias como hashtags',
	updateInterval: 'Intervalo de atualização',
	updateIntervalDesc: 'Com que frequência verificar os feeds (em minutos, 0 para desativar)',
	includeImages: 'Incluir imagens',
	includeImagesDesc: 'Incluir URLs de imagens dos artigos do feed',
	fetchImageFromLink: 'Buscar imagem pelo link',
	fetchImageFromLinkDesc: 'Se o feed RSS não tiver imagem, busca a imagem OGP pelo link do artigo (pode demorar mais)',
	imageWidth: 'Largura das imagens',
	imageWidthDesc: 'Largura das imagens no conteúdo (ex: 50%, 300px)',
	autoDeleteOldArticles: 'Excluir artigos antigos automaticamente',
	autoDeleteOldArticlesDesc: 'Exclui artigos automaticamente após um determinado período',
	periodBeforeDeletion: 'Período antes da exclusão',
	periodBeforeDeletionDesc: 'Excluir artigos após este período desde a criação',
	timeUnit: 'Unidade de tempo',
	timeUnitDesc: 'Unidade para o período de exclusão',
	deletionCriteria: 'Critério de exclusão',
	deletionCriteriaDesc: 'Critério para excluir artigos',
	addNewFeed: 'Adicionar novo feed',
	addNewFeedDesc: 'Adicionar um novo feed RSS para baixar',
	updateFeedsNow: 'Atualizar feeds agora',
	updateFeedsNowDesc: 'Atualizar manualmente todos os feeds RSS habilitados',

	// Modal
	feedName: 'Nome do feed',
	feedUrl: 'URL do feed',
	customFolderName: 'Nome de pasta personalizado (opcional)',
	customFolderNameDesc: 'Subpasta dentro da pasta RSS',
	customFolderPlaceholder: 'Deixe vazio para usar o nome do feed',

	// Buttons
	addFeed: 'Adicionar feed',
	editFeed: 'Editar feed',
	deleteFeed: 'Excluir feed',
	save: 'Salvar',
	cancel: 'Cancelar',
	updateNow: 'Atualizar agora',
	savedFeed: 'Feed salvo: %0',
	errorSavingFeed: 'Falha ao salvar feed',

	// Settings header
	rssFeedDownloaderSettings: 'Configurações do downloader de feeds RSS',

	// Time units
	days: 'Dias',
	minutes: 'Minutos',

	// Date options
	publishedDate: 'Data de publicação',
	savedDate: 'Data de salvamento',

	// Download history
	downloadHistory: 'Histórico de downloads',
	downloadHistoryDesc: 'Número de URLs de artigos baixados armazenados: %0',
	clearDownloadHistory: 'Limpar histórico',
	downloadHistoryCleared: 'Histórico de downloads limpo',

	// Per-feed settings
	useCustomTemplate: 'Usar template personalizado',
	useCustomTemplateDesc: 'Substituir o template global de conteúdo para este feed. Quando desativado, a configuração global é usada.',
	useCustomAutoDelete: 'Usar exclusão automática personalizada',
	useCustomAutoDeleteDesc: 'Substituir as configurações globais de exclusão automática para este feed. Quando desativado, a configuração global é usada.',
	customSettingsIndicator: 'Possui configurações personalizadas',
};