module.exports = {
  /**
   * Name of the integration which is displayed in the Polarity integrations user interface
   * @type String
   * @required
   */
  name: 'Confluence',
  /**
   * The acronym that appears in the notification window when information from this integration
   * is displayed.  Note that the acronym is included as part of each "tag" in the summary information
   * for the integration.  As a result, it is best to keep it to 4 or less characters.  The casing used
   * here will be carried forward into the notification window.
   *
   * @type String
   * @required
   */
  acronym: 'CONF',
  /**
   * Description for this integration which is displayed in the Polarity integrations user interface
   *
   * @type String
   * @optional
   */
  description: 'Lookup Confluence pages by keywords or phrases',
  entityTypes: ['*'],
  // customTypes: [
  //   {
  //     key: 'possiblyDefangedUrl',
  //     regex:
  //       /(?:\w+(?:(?:\[:\]\/\/)|(?::\/\/)|(?:\[:\/\/\])))?(?:\w+\.|(?:\w+\[\.\]))+\w+(?:\/(?:[\/=\.\[\]\w&#@$%?-])*)?/
  //   }
  // ],
  defaultColor: 'light-gray',
  /**
   * An array of style files (css or less) that will be included for your integration. Any styles specified in
   * the below files can be used in your custom template.
   *
   * @type Array
   * @optional
   */
  styles: ['./styles/confluence.less'],
  /**
   * Provide custom component logic and template for rendering the integration details block.  If you do not
   * provide a custom template and/or component then the integration will display data as a table of key value
   * pairs.
   *
   * @type Object
   * @optional
   */
  block: {
    component: {
      file: './components/confluence-block.js'
    },
    template: {
      file: './templates/confluence-block.hbs'
    }
  },

  logging: {
    level: 'info' //trace, debug, info, warn, error, fatal
  },

  request: {
    // Provide the path to your certFile. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    cert: '',
    // Provide the path to your private key. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    key: '',
    // Provide the key passphrase if required.  Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    passphrase: '',
    // Provide the Certificate Authority. Leave an empty string to ignore this option.
    // Relative paths are relative to the integration's root directory
    ca: '',
    // An HTTP proxy to be used. Supports proxy Auth with Basic Auth, identical to support for
    // the url parameter (by embedding the auth info in the uri)
    proxy: ""
  },
  /**
   * Options that are displayed to the user/admin in the Polarity integration user-interface.  Should be structured
   * as an array of option objects.
   *
   * @type Array
   * @optional
   */
  options: [
    {
      key: 'baseUrl',
      name: 'Confluence Base Url',
      description:
        'Your Confluence Base Url to include the schema (i.e., https://) and port if required. Example "https://mycompany.atlassian.net/wiki".',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'confluenceType',
      name: 'Confluence Version',
      description: 'Select the version of Confluence you are authenticating to.',
      default: {
        value: 'cloud',
        display: 'Cloud'
      },
      options: [
        {
          value: 'cloud',
          display: 'Confluence Cloud'
        },
        {
          value: 'server',
          display: 'Confluence Server v7.9+'
        }
      ],
      multiple: false,
      type: 'select',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'userName',
      name: 'Confluence Account Email',
      description: 'Your Confluence account email address (only required for Confluence Cloud).',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'apiKey',
      name: 'Confluence API Token',
      description: 'Your Confluence API token (required for both Confluence Server and Confluence Cloud)',
      default: '',
      type: 'password',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'spaceKeys',
      name: 'Space Keys',
      description:
        'A comma delimited list of Confluence Space Keys to search.  If left blank, all spaces will be searched.',
      default: '',
      type: 'text',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'reduceFuzziness',
      name: 'Reduce Search Fuzziness',
      description:
        'If checked, the integration will return fewer results with more of an exact string match on your entities.',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchTitlesOnly',
      name: 'Search Titles Only',
      description: 'If checked, the integration will only search the title of pages',
      default: false,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchPage',
      name: 'Confluence Page Search',
      description: 'If checked, the integration will search keywords/phrases in Confluence pages',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchAttachments',
      name: 'Confluence Attachment Search',
      description: 'If checked, the integration will search keywords/phrases in Confluence attachments',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchBlog',
      name: 'Confluence Blog Search',
      description: 'If checked, the integration will search keywords/phrases in Confluence blogs',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    },
    {
      key: 'searchSpace',
      name: 'Confluence Space Search',
      description: 'If checked, the integration will return Confluence space names that contain the search term',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};
