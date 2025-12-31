#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use enigo::{Enigo, Mouse, Settings, Button, Coordinate::Abs, Direction, Keyboard, Key};

// ===== MOUSE CONTROL =====
#[tauri::command]
fn move_mouse(x: i32, y: i32) -> Result<String, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.move_mouse(x, y, Abs).map_err(|e| e.to_string())?;
    Ok(format!("Mouse moved to ({}, {})", x, y))
}

#[tauri::command]
fn click_mouse(button: String) -> Result<String, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let btn = match button.as_str() {
        "left" => Button::Left,
        "right" => Button::Right,
        "middle" => Button::Middle,
        _ => return Err("Invalid button".to_string()),
    };
    enigo.button(btn, Direction::Click).map_err(|e| e.to_string())?;
    Ok(format!("Clicked {} mouse button", button))
}

#[tauri::command]
fn get_mouse_position() -> Result<(i32, i32), String> {
    let enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let (x, y) = enigo.location().map_err(|e| e.to_string())?;
    Ok((x, y))
}

// ===== KEYBOARD CONTROL =====
#[tauri::command]
fn type_text(text: String) -> Result<String, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.text(&text).map_err(|e| e.to_string())?;
    Ok(format!("Typed: {}", text))
}

#[tauri::command]
fn press_key(key: String) -> Result<String, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let k = match key.as_str() {
        "enter" => Key::Return,
        "space" => Key::Space,
        "tab" => Key::Tab,
        "escape" => Key::Escape,
        "backspace" => Key::Backspace,
        "delete" => Key::Delete,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        _ => return Err("Invalid key".to_string()),
    };
    enigo.key(k, Direction::Click).map_err(|e| e.to_string())?;
    Ok(format!("Pressed key: {}", key))
}

// ===== FILE OPERATIONS =====
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<String, String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(format!("File written: {}", path))
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let mut results = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            if let Some(name) = entry.file_name().to_str() {
                results.push(name.to_string());
            }
        }
    }
    Ok(results)
}

// ===== NETWORK OPERATIONS =====
#[tauri::command]
async fn download_file(url: String, destination: String) -> Result<String, String> {
    let response = reqwest::blocking::get(&url)
        .map_err(|e| format!("Download failed: {}", e))?;
    
    let content = response.bytes()
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    std::fs::write(&destination, content)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    
    Ok(format!("Downloaded to: {}", destination))
}

#[tauri::command]
async fn search_web(query: String) -> Result<String, String> {
    let search_url = format!("https://html.duckduckgo.com/html/?q={}", 
        urlencoding::encode(&query));
    
    let response = reqwest::blocking::get(&search_url)
        .map_err(|e| format!("Search failed: {}", e))?;
    
    let html = response.text()
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    Ok(html[..1000.min(html.len())].to_string())
}

// ===== EXECUTE PYTHON CODE =====
#[tauri::command]
async fn execute_python(code: String) -> Result<String, String> {
    let temp_file = std::env::temp_dir().join("jarvis_temp.py");
    std::fs::write(&temp_file, &code)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    let output = Command::new("python")
        .arg(temp_file.to_str().unwrap())
        .output()
        .map_err(|e| format!("Failed to execute Python: {}. Is Python installed?", e))?;
    
    let _ = std::fs::remove_file(&temp_file);
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if !stderr.is_empty() && !output.status.success() {
        return Err(format!("Python Error:\n{}", stderr));
    }
    
    Ok(format!("{}{}", stdout, if !stderr.is_empty() { format!("\nWarnings:\n{}", stderr) } else { String::new() }))
}

// ===== EXECUTE POWERSHELL CODE =====
#[tauri::command]
async fn execute_powershell(code: String) -> Result<String, String> {
    let output = Command::new("powershell")
        .args(&["-Command", &code])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if !stderr.is_empty() && !output.status.success() {
        return Err(format!("PowerShell Error:\n{}", stderr));
    }
    
    Ok(format!("{}{}", stdout, if !stderr.is_empty() { format!("\nWarnings:\n{}", stderr) } else { String::new() }))
}

// ===== INSTALL PYTHON PACKAGE =====
#[tauri::command]
async fn install_python_package(package: String) -> Result<String, String> {
    let output = Command::new("pip")
        .args(&["install", &package])
        .output()
        .map_err(|e| format!("Failed to install package: {}. Is pip installed?", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    Ok(format!("{}\n{}", stdout, stderr))
}

// ===== EXECUTE ANY COMMAND =====
#[tauri::command]
async fn execute_shell(command: String, args: Vec<String>) -> Result<String, String> {
    let output = Command::new(&command)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if !output.status.success() && !stderr.is_empty() {
        return Err(format!("Error:\n{}", stderr));
    }
    
    Ok(format!("{}{}", stdout, if !stderr.is_empty() { format!("\n{}", stderr) } else { String::new() }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            move_mouse,
            click_mouse,
            get_mouse_position,
            type_text,
            press_key,
            read_file,
            write_file,
            list_directory,
            download_file,
            search_web,
            execute_python,
            execute_powershell,
            install_python_package,
            execute_shell
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
