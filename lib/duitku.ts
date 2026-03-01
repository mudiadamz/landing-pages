import crypto from "crypto";

const SANDBOX = "https://api-sandbox.duitku.com";
const PROD = "https://api-prod.duitku.com";

export type DuitkuCreateInvoiceParams = {
  paymentAmount: number;
  merchantOrderId: string;
  productDetails: string;
  email: string;
  phoneNumber?: string;
  customerVaName: string;
  itemDetails: Array<{ name: string; price: number; quantity: number }>;
  customerDetail: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    billingAddress: {
      firstName: string;
      lastName: string;
      address: string;
      city: string;
      postalCode: string;
      phone: string;
      countryCode: string;
    };
    shippingAddress: {
      firstName: string;
      lastName: string;
      address: string;
      city: string;
      postalCode: string;
      phone: string;
      countryCode: string;
    };
  };
  additionalParam?: string;
  callbackUrl: string;
  returnUrl: string;
  expiryPeriod?: number;
};

export type DuitkuCreateInvoiceResponse = {
  merchantCode: string;
  reference: string;
  paymentUrl: string;
  statusCode: string;
  statusMessage: string;
};

export async function createDuitkuInvoice(
  params: DuitkuCreateInvoiceParams
): Promise<DuitkuCreateInvoiceResponse> {
  const merchantCode = process.env.DUITKU_MERCHANT_CODE;
  const merchantKey = process.env.DUITKU_API_KEY;
  const sandbox = process.env.DUITKU_SANDBOX !== "false";

  if (!merchantCode || !merchantKey) {
    throw new Error("DUITKU_MERCHANT_CODE and DUITKU_API_KEY must be set");
  }

  const timestamp = Math.round(Date.now());
  const signature = crypto
    .createHash("sha256")
    .update(merchantCode + timestamp + merchantKey)
    .digest("hex");

  const baseUrl = sandbox ? SANDBOX : PROD;
  const url = `${baseUrl}/api/merchant/createInvoice`;

  const body = {
    paymentAmount: params.paymentAmount,
    merchantOrderId: params.merchantOrderId,
    productDetails: params.productDetails,
    additionalParam: params.additionalParam ?? "",
    merchantUserInfo: "",
    paymentMethod: "",
    customerVaName: params.customerVaName,
    email: params.email,
    phoneNumber: params.phoneNumber ?? "",
    itemDetails: params.itemDetails,
    customerDetail: params.customerDetail,
    creditCardDetail: { saveCardToken: 0 },
    callbackUrl: params.callbackUrl,
    returnUrl: params.returnUrl,
    expiryPeriod: params.expiryPeriod ?? 60,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-duitku-signature": signature,
      "x-duitku-timestamp": String(timestamp),
      "x-duitku-merchantcode": merchantCode,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as DuitkuCreateInvoiceResponse & {
    statusMessage?: string;
    statusCode?: string;
    responseCode?: string;
    responseMessage?: string;
  };

  const code = data.statusCode ?? data.responseCode;
  const message = data.statusMessage ?? data.responseMessage;

  if (code !== "00") {
    const errMsg = [message, `statusCode: ${code}`, JSON.stringify(data)]
      .filter(Boolean)
      .join(" — ");
    console.error("Duitku createInvoice response:", data);
    throw new Error(errMsg || "Duitku create invoice failed");
  }

  return data as DuitkuCreateInvoiceResponse;
}

export type DuitkuCallbackParams = {
  merchantCode: string;
  amount: number;
  merchantOrderId: string;
  resultCode: string;
  reference: string;
  signature: string;
};

export function validateDuitkuCallback(params: DuitkuCallbackParams): boolean {
  const merchantKey = process.env.DUITKU_API_KEY;
  if (!merchantKey) return false;

  const calcSignature = crypto
    .createHash("md5")
    .update(
      params.merchantCode + params.amount + params.merchantOrderId + merchantKey
    )
    .digest("hex");

  return calcSignature === params.signature;
}
