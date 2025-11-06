export default {
	// Commands
	updateRssFeeds: "Mettre à jour les flux RSS",
	addRssFeed: "Ajouter un flux RSS",

	// Notices
	updatingRssFeeds: "Mise à jour des flux RSS...",
	failedToFetchFeed: "Échec de la récupération du flux: %0",
	unsupportedFeedFormat: "Format de flux non supporté: %0",
	updatedFeed: "Flux mis à jour: %0",
	errorUpdatingFeed: "Erreur lors de la mise à jour du flux: %0",
	rssFeedUpdateCompleted: "Mise à jour du flux RSS effectuée",
	feedNameRequired: "Nom du flux requis",
	feedUrlRequired: "URL du flux requise",
	addedFeed: "Flux ajouté: %0",

	// Settings
	rssFolder: "Dossier RSS",
	rssFolderDesc: "Dossier où les articles RSS seront enregistrés",
	fileNameTemplate: "File name template",
	fileNameTemplateDesc:
		"Modèle pour les noms des articles. Les variables {{title}} (titre) et {{published}} (date de publication) sont disponibles",
	contentTemplate: "Modèle de contenu",
	contentTemplateDesc: "Modèle pour les articles incluant les propritétés",
	availableVariables: "Variables disponibles",
	varTitle: "Titre de l'article",
	varLink: "URL de l'article original",
	varAuthor: "Nom de l'auteur de l'article",
	varPublishedTime: "Date et heure de publication",
	varSavedTime: "Date et heure de sauvegarde",
	varImage: "URL de l'image de l'article",
	varDescription: "Description complète de l'article",
	varDescriptionShort: "Description courte",
	varContent: "Contenu complet de l'article",
	varTags: "Catégories, sous forme de tags",
	updateInterval: "Intervalle de mise à jour",
	updateIntervalDesc:
		"Durée de l'intervalle entre les mises à jour (en minutes, 0 pour désactiver)",
	includeImages: "Inclure les images",
	includeImagesDesc: "Inclure les URL des images depuis les articles",
	fetchImageFromLink: "Récupérer l'image depuis le lien",
	fetchImageFromLinkDesc:
		"Si le flux RSS n'a pas d'image, récupérer l'image OGP depuis le lien de l'article (peut prendre plus de temps)",
	imageWidth: "Largeur des images",
	imageWidthDesc: "Largeur des images dans le contenu (ex: 50%, 300px)",
	autoDeleteOldArticles: "Supprimer automatiquement les anciens articles",
	autoDeleteOldArticlesDesc:
		"Supprime automatiquement les articles après un certain temps",
	periodBeforeDeletion: "Temps avant suppression",
	periodBeforeDeletionDesc:
		"Supprime les articles une fois que cette durée s'est écoulée depuis la création",
	timeUnit: "Unité temporelle",
	timeUnitDesc: "Unité pour la période avant suppression",
	deletionCriteria: "Critères de suppression",
	deletionCriteriaDesc: "Critères pour supprimer les articles",
	addNewFeed: "Ajouter un nouveau flux",
	addNewFeedDesc: "Ajouter un nouveau flux RSS à télécharger",
	updateFeedsNow: "Mettre à jour les flux maintenant",
	updateFeedsNowDesc: "Mise à jour manuelle de tous les flux RSS activés",

	// Modal
	feedName: "Nom du flux",
	feedUrl: "URL du flux",
	customFolderName: "Nom du dossier personnalisé (facultatif)",
	customFolderNameDesc: "Nom du sous-dossier dans le dossier RSS",
	customFolderPlaceholder: "Laisser vide pour utiliser le nom du flux",

	// Buttons
	addFeed: "Ajouter un flux",
	cancel: "Annuler",
	updateNow: "Mettre à jour",

	// Settings header
	rssFeedDownloaderSettings: "Paramètres du téléchargement des flux RSS",

	// Time units
	days: "Jours",
	minutes: "Minutes",

	// Date options
	publishedDate: "Date de publication",
	savedDate: "Date de sauvegarde",
};
