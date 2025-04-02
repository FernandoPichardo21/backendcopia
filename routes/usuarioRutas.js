import { Router } from "express";
import {  login,  register , obtenerUsuarios} from "../db/usuariosBD.js";
import { usuarioAutorizado, adminAutorizado } from "../middlewares/funcionesPassword.js";
import { temperatureHistory, client,  publicarMedicamento } from "../mqtt/mqtt.js";
import Medicamento from "../models/medicamento.js";

const router = Router();

router.post("/registro", async(req,res)=>{
    console.log(req.body);
    const respuesta = await register(req.body);
    console.log(respuesta);
    res.cookie('token',respuesta.token).status(respuesta.status).json(respuesta.mensajeUsuario);
});

router.post("/inicioSesion", async (req, res) => {
 // console.log("BODY RECIBIDO:", req.body);
    const respuesta = await login(req.body);
    res.cookie('token',respuesta.token).status(respuesta.status).json(respuesta.mensajeUsuario);
});


router.get("/cerrarSesion", (req, res) => {
  res.cookie("token", "", { expires: new Date(0) }).clearCookie("token").status(200).json("Sesion cerrada correctamente");
});


router.get("/administradores", async(req, res) => {
  const respuesta = await adminAutorizado(req);
  res.status(respuesta.status).json(respuesta.mensajeUsuario);
  
});

router.get("/libre", (req, res) => {
  res.json("Aqui puedes entrar sin eatar logueado");
});


router.get("/usuarios", async (req, res) => {
  const respuesta = await obtenerUsuarios();
  res.status(respuesta.status).json(respuesta);
});


router.get("/mqtt/test", (req, res) => {
  const testMessage = {
    timestamp: new Date().toISOString(),
    test: true,
    message: "Prueba de conexión MQTT"
  };
  
  req.mqttClient.publish("raspberry/temperatura", JSON.stringify(testMessage));
  res.json({ 
    success: true, 
    message: "Mensaje de prueba enviado a HiveMQ",
    mqttConnected: req.mqttClient.connected
  });
});

router.get("/mqtt/status", (req, res) => {
  res.json({
    connected: req.mqttClient.connected,
    connectionState: req.mqttClient.connected ? "Conectado" : "Desconectado"
  });
});


// Ruta para obtener historial de temperatura
router.get("/mqtt/historial", (req, res) => {
  res.json({ 
    success: true, 
    historial: temperatureHistory
 });
});


//Aqui hacia abajo lo agregue yo 

router.put("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
      const respuesta = await actualizarUsuario(id, req.body);
      res.status(respuesta.status).json(respuesta.mensajeUsuario);
  } catch (error) {
      res.status(500).json({ mensaje: "Error interno del servidor", error });
  }
});

router.delete("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
      const respuesta = await borrarUsuario(id);
      res.status(respuesta.status).json(respuesta.mensajeUsuario);
  } catch (error) {
      res.status(500).json({ mensaje: "Error interno del servidor", error });
  }
});


//Endpoint para programar medicamento
router.post("/mqtt/programar", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, hora, compartimiento, cantidad, nombre } = req.body;

    if (!fechaInicio || !fechaFin || !hora || !compartimiento || !cantidad || !nombre) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    const datos = { fechaInicio, fechaFin, hora, compartimiento, cantidad, nombre };

    // 🔹 Publicar datos en MQTT
    publicarMedicamento(datos);

    // 🔹 Guardar en la base de datos
    const nuevoMedicamento = new Medicamento(datos);
    await nuevoMedicamento.save();

    res.status(201).json({ mensaje: "Datos enviados a MQTT y guardados correctamente" });
  } catch (error) {
    console.error("Error en /mqtt/programar:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;