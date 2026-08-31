# Connector entrypoints are discovered through the signed bundle manifest.
-keep public class * implements com.aiwos.connector.sdk.v1.AndroidConnectorPlugin { public *; }
-keep interface com.aiwos.connector.sdk.v1.** { *; }
-keep class com.aiwos.connector.sdk.v1.** { *; }
