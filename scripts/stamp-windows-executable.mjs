import fs from 'node:fs/promises'
import path from 'node:path'
import * as PELibrary from 'pe-library'
import * as ResEdit from 'resedit'

const WINDOWS_PLATFORM = 'win32'
const EN_US = 1033

export default async function stampWindowsExecutable(context) {
  if (context.electronPlatformName !== WINDOWS_PLATFORM) return

  const appInfo = context.packager.appInfo
  const executablePath = path.join(context.appOutDir, `${appInfo.productFilename}.exe`)
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico')
  const temporaryPath = `${executablePath}.stamped`
  const version = `${appInfo.version}.0`

  const executableData = await fs.readFile(executablePath)
  const executable = PELibrary.NtExecutable.from(executableData)
  const resources = PELibrary.NtExecutableResource.from(executable)
  const iconFile = ResEdit.Data.IconFile.from(await fs.readFile(iconPath))
  const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries)

  if (iconGroups.length === 0) {
    throw new Error(`No icon group found in ${executablePath}`)
  }

  for (const group of iconGroups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      resources.entries,
      group.id,
      group.lang,
      iconFile.icons.map((item) => item.data),
    )
  }

  const versionEntries = ResEdit.Resource.VersionInfo.fromEntries(resources.entries)
  if (versionEntries.length === 0) {
    throw new Error(`No version resource found in ${executablePath}`)
  }

  for (const versionInfo of versionEntries) {
    versionInfo.setFileVersion(version, EN_US)
    versionInfo.setProductVersion(version, EN_US)
    versionInfo.setStringValues(
      { lang: EN_US, codepage: 1200 },
      {
        CompanyName: 'Skip',
        FileDescription: 'Laomedeia',
        InternalName: 'Laomedeia',
        LegalCopyright: 'Copyright © 2026 Skip',
        OriginalFilename: 'Laomedeia.exe',
        ProductName: 'Laomedeia',
      },
    )
    versionInfo.outputToResourceEntries(resources.entries)
  }

  resources.outputResource(executable)
  await fs.writeFile(temporaryPath, Buffer.from(executable.generate()))
  await fs.rename(temporaryPath, executablePath)
}
