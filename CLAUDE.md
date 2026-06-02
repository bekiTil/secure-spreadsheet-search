<project_prompt>
  <role>
    You are a senior software architect, product designer, security engineer, and full-stack developer.
  </role>

  <project>
    <name>Secure Spreadsheet Search</name>
    <type>Cross-platform offline desktop application</type>
    <quality_standard>Production-ready, not a prototype</quality_standard>
  </project>

  <core_goal>
    Build a secure offline desktop app for non-technical users to import spreadsheet files, search records quickly, and securely share searchable datasets.
  </core_goal>

  <user_experience>
    <principle>The app should feel simple: Install → Import → Search → Share.</principle>
    <avoid>
      <item>Do not expose databases</item>
      <item>Do not expose APIs</item>
      <item>Do not expose SQL</item>
      <item>Do not expose JSON</item>
      <item>Do not require command-line usage</item>
      <item>Do not require technical setup</item>
    </avoid>
  </user_experience>

  <technology_stack>
    <frontend>React</frontend>
    <language>TypeScript</language>
    <desktop_framework>Tauri</desktop_framework>
    <database>SQLite</database>
    <encryption>SQLCipher or equivalent</encryption>
  </technology_stack>

  <platforms>
    <platform>Windows 10+</platform>
    <platform>Windows 11</platform>
    <platform>macOS Intel</platform>
    <platform>macOS Apple Silicon</platform>
    <platform>Linux</platform>
  </platforms>

  <supported_files>
    <file_type>XLSX</file_type>
    <file_type>XLS</file_type>
    <file_type>CSV</file_type>
    <file_type>TSV</file_type>
    <future_file_type>ODS</future_file_type>
  </supported_files>

  <offline_requirements>
    <requirement>Work completely offline</requirement>
    <requirement>Never upload user data</requirement>
    <requirement>Never use cloud services</requirement>
    <requirement>Never require account creation</requirement>
    <requirement>Never require login</requirement>
  </offline_requirements>

  <import_workflow>
    <step>User selects a spreadsheet file</step>
    <step>App validates the file</step>
    <step>App previews rows and columns</step>
    <step>App detects all column names dynamically</step>
    <step>User selects one or more searchable columns</step>
    <step>App imports the data into encrypted local storage</step>
    <step>App confirms import success</step>
  </import_workflow>

  <search_requirements>
    <feature>Exact match search</feature>
    <feature>Partial search</feature>
    <feature>Contains search</feature>
    <feature>Prefix search</feature>
    <feature>Multi-column search</feature>
    <feature>Case-insensitive search</feature>
  </search_requirements>

  <security_requirements>
    <requirement>Encrypt local datasets</requirement>
    <requirement>Encrypt shareable bundles</requirement>
    <requirement>Password-protect bundles</requirement>
    <requirement>Hash passwords securely</requirement>
    <requirement>Detect tampering</requirement>
    <requirement>Never store passwords in plaintext</requirement>
    <requirement>Never log spreadsheet contents</requirement>
    <requirement>Never log search queries</requirement>
    <requirement>Never send telemetry</requirement>
  </security_requirements>

  <shareable_bundle_system>
    <extension>.companybundle</extension>
    <purpose>Allow users to securely send searchable datasets to other users.</purpose>
    <contents>
      <item>Dataset</item>
      <item>Search configuration</item>
      <item>Metadata</item>
      <item>Security information</item>
      <optional_item>Original spreadsheet if explicitly selected by user</optional_item>
    </contents>
    <requirements>
      <requirement>Encrypted</requirement>
      <requirement>Password protected</requirement>
      <requirement>Tamper-resistant</requirement>
      <requirement>Double-click opens app when installed</requirement>
    </requirements>
  </shareable_bundle_system>

  <receiver_use_cases>
    <use_case name="Receiver has app installed">
      <step>User double-clicks .companybundle file</step>
      <step>Application opens automatically</step>
      <step>User enters password</step>
      <step>Dataset imports</step>
      <step>Search becomes available</step>
    </use_case>

    <use_case name="Receiver does not have app installed">
      <step>User receives .companybundle file</step>
      <step>User is guided to install the app</step>
      <step>After installation, the bundle opens automatically</step>
      <step>Import continues without technical setup</step>
    </use_case>
  </receiver_use_cases>

  <required_screens>
    <screen name="Home">
      <item>Import Spreadsheet</item>
      <item>Search Data</item>
      <item>Manage Datasets</item>
      <item>Share Dataset</item>
      <item>Settings</item>
    </screen>

    <screen name="Import Wizard">
      <item>File Selection</item>
      <item>Preview</item>
      <item>Searchable Column Selection</item>
      <item>Import Summary</item>
    </screen>

    <screen name="Search Screen">
      <item>Search Input</item>
      <item>Column Selector</item>
      <item>Search Results Table</item>
    </screen>

    <screen name="Manage Datasets">
      <item>Rename Dataset</item>
      <item>Delete Dataset</item>
      <item>Backup Dataset</item>
      <item>Share Dataset</item>
    </screen>

    <screen name="Settings">
      <item>Security</item>
      <item>Storage</item>
      <item>Backup Preferences</item>
    </screen>
  </required_screens>

  <test_cases>
    <import_tests>
      <test>Import XLSX file</test>
      <test>Import XLS file</test>
      <test>Import CSV file</test>
      <test>Import TSV file</test>
      <test>Reject invalid file</test>
      <test>Handle corrupted file without crashing</test>
      <test>Import large file successfully</test>
    </import_tests>

    <search_tests>
      <test>Exact search</test>
      <test>Partial search</test>
      <test>Case-insensitive search</test>
      <test>Multi-column search</test>
      <test>Empty search</test>
      <test>No results found</test>
    </search_tests>

    <bundle_tests>
      <test>Export encrypted bundle</test>
      <test>Import encrypted bundle</test>
      <test>Reject wrong password</test>
      <test>Reject corrupted bundle</test>
      <test>Reject modified bundle</test>
      <test>Reject missing metadata</test>
    </bundle_tests>

    <installation_tests>
      <test>Fresh install</test>
      <test>Upgrade install</test>
      <test>Reinstall while keeping data</test>
      <test>Uninstall and delete data</test>
    </installation_tests>
  </test_cases>

  <deliverables>
    <item>Complete system architecture</item>
    <item>Folder structure</item>
    <item>Database design</item>
    <item>Security design</item>
    <item>Bundle file format specification</item>
    <item>UI wireframes</item>
    <item>React components</item>
    <item>Tauri backend implementation</item>
    <item>Import engine</item>
    <item>Search engine</item>
    <item>Bundle import/export engine</item>
    <item>Installer configuration</item>
    <item>Automated tests</item>
    <item>Build scripts</item>
    <item>Deployment documentation</item>
    <item>User documentation</item>
  </deliverables>

  <priorities>
    <priority>Security</priority>
    <priority>Simplicity</priority>
    <priority>Reliability</priority>
    <priority>Performance</priority>
    <priority>Cross-platform compatibility</priority>
  </priorities>

  <final_requirement>
    The final result must be installable by a non-technical employee and usable without any training.
  </final_requirement>
</project_prompt>