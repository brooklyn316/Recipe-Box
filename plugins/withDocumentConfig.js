/**
 * Config plugin that correctly sets the iOS document-type configuration
 * required by Apple (ITMS-90737 and ITMS-90788).
 *
 * Runs last so it cannot be overwritten by other plugins.
 *
 * Sets:
 *   - LSSupportsOpeningDocumentsInPlace = false  (ITMS-90737)
 *   - LSHandlerRank = "Owner" on every CFBundleDocumentTypes entry  (ITMS-90788)
 *   - CFBundleTypeRole = "Owner" to match LSHandlerRank
 */

const { withInfoPlist } = require('@expo/config-plugins');

module.exports = function withDocumentConfig(config) {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;

    // ── ITMS-90737 ───────────────────────────────────────────────────────────
    // Must declare one of LSSupportsOpeningDocumentsInPlace or
    // UISupportsDocumentBrowser. We open files by copying them in, so false.
    plist.LSSupportsOpeningDocumentsInPlace = false;

    // ── ITMS-90788 ───────────────────────────────────────────────────────────
    // Every CFBundleDocumentTypes entry must have LSHandlerRank.
    if (Array.isArray(plist.CFBundleDocumentTypes)) {
      plist.CFBundleDocumentTypes = plist.CFBundleDocumentTypes.map((docType) => {
        if (docType.CFBundleTypeName === 'Recipe Box Recipe') {
          return {
            ...docType,
            CFBundleTypeRole: 'Owner',
            LSHandlerRank: 'Owner',
          };
        }
        // Add Owner rank to any other document types that are missing it
        if (!docType.LSHandlerRank) {
          return { ...docType, LSHandlerRank: 'Alternate' };
        }
        return docType;
      });
    } else {
      // Fallback: write the full entry if nothing was set by app.json
      plist.CFBundleDocumentTypes = [
        {
          CFBundleTypeName: 'Recipe Box Recipe',
          CFBundleTypeRole: 'Owner',
          LSHandlerRank: 'Owner',
          LSItemContentTypes: ['com.dardern.recipebox.recipe'],
        },
      ];
    }

    return config;
  });
};
