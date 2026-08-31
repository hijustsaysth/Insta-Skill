plugins {
    id("com.android.library")
}

android {
    namespace = "com.aiwos.connectors.instagram"
    compileSdk = 36
    defaultConfig { minSdk = 26 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(project(":connector-sdk"))
    implementation(project(":local-mobile-runtime"))
    implementation("org.json:json:20250517")
    testImplementation(project(":connector-sdk"))
    testImplementation("junit:junit:4.13.2")
}

tasks.register<JavaExec>("invokeLocalInstagramRuntime") {
    group = "verification"
    description = "Invoke InstagramConnector through LocalAdbMobileRuntime."
    val unitTest = tasks.named<Test>("testDebugUnitTest")
    val debugClassesJar = layout.buildDirectory.file("intermediates/compile_library_classes_jar/debug/bundleLibCompileToJarDebug/classes.jar")
    val connectorSdkClassesJar = project(":connector-sdk").layout.buildDirectory.file("intermediates/compile_library_classes_jar/debug/bundleLibCompileToJarDebug/classes.jar")
    val localMobileRuntimeClassesJar = project(":local-mobile-runtime").layout.buildDirectory.file("intermediates/compile_library_classes_jar/debug/bundleLibCompileToJarDebug/classes.jar")
    dependsOn(
        ":connector-sdk:bundleLibCompileToJarDebug",
        ":local-mobile-runtime:bundleLibCompileToJarDebug",
        "bundleLibCompileToJarDebug",
        "compileDebugUnitTestJavaWithJavac"
    )
    mainClass.set("com.aiwos.connectors.instagram.InstagramLocalRuntimeCommand")
    workingDir = rootProject.projectDir
    doFirst {
        val testTask = unitTest.get()
        classpath = files(debugClassesJar, connectorSdkClassesJar, localMobileRuntimeClassesJar) + testTask.classpath + testTask.testClassesDirs
        val forwarded = System.getProperties()
            .filterKeys { it.toString().startsWith("instagram.local.") }
            .mapKeys { it.key.toString() }
        systemProperties(forwarded)
    }
}
