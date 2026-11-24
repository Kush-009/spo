
param([string]$action, [int]$value = -1)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int _0(); int _1(); int _2(); int _3();
    int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
    int _5();
    int GetMasterVolumeLevelScalar(out float pfLevel);
    int _7(); int _8(); int _9(); int _10();
    int GetMute(out bool pbMute);
    int SetMute(bool bMute, System.Guid pguidEventContext);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }

public class AudioManager {
    private static IAudioEndpointVolume GetVol() {
        var enumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
        IMMDevice dev;
        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
        IAudioEndpointVolume epv;
        var epvid = typeof(IAudioEndpointVolume).GUID;
        dev.Activate(ref epvid, 23, 0, out epv);
        return epv;
    }
    public static int GetVolume() {
        float v; GetVol().GetMasterVolumeLevelScalar(out v); return (int)Math.Round(v * 100);
    }
    public static void SetVolume(int pct) {
        GetVol().SetMasterVolumeLevelScalar(pct / 100f, System.Guid.Empty);
    }
    public static bool GetMute() {
        bool m; GetVol().GetMute(out m); return m;
    }
    public static void SetMute(bool mute) {
        GetVol().SetMute(mute, System.Guid.Empty);
    }
}
"@

if ($action -eq "get") {
    Write-Output ([AudioManager]::GetVolume())
} elseif ($action -eq "set") {
    [AudioManager]::SetVolume($value)
    Write-Output "OK"
} elseif ($action -eq "mute") {
    [AudioManager]::SetMute($true)
    Write-Output "OK"
} elseif ($action -eq "unmute") {
    [AudioManager]::SetMute($false)
    Write-Output "OK"
} elseif ($action -eq "getmute") {
    Write-Output ([AudioManager]::GetMute())
}
