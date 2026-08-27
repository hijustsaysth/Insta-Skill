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
    dependsOn("compileDebugUnitTestJavaWithJavac")
    mainClass.set("com.aiwos.connectors.instagram.InstagramLocalRuntimeCommand")
    workingDir = rootProject.projectDir
    doFirst {
        val testTask = unitTest.get()
        classpath = testTask.classpath + testTask.testClassesDirs
        val forwarded = System.getProperties()
            .filterKeys { it.toString().startsWith("instagram.local.") }
            .mapKeys { it.key.toString() }
        systemProperties(forwarded)
    }
}
