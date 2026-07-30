import { DatePicker } from "@/components/DatePicker";
import SubPageHeader from "@/components/SubPageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
import { BillForm } from "../types";
import Dropzone from "react-dropzone";
import { useEffect, useMemo, useState } from "react";
import { ExtractSchemaType } from "@/lib/scrapeBill";
import { uploadReceiptImage } from "@/lib/client-receipt-upload";
import { MAX_RECEIPT_UPLOAD_BYTES } from "@/lib/image-upload";
import { createId } from "../utils";
import Decimal from "decimal.js";

export const UploadOrManualBill = ({
  isManual,
  goBack,
  goForward,
  formObject,
}: {
  isManual: boolean;
  goBack: () => void;
  goForward: () => void;
  formObject: UseFormReturn<BillForm>;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register, watch } = formObject;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLoading) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isLoading]);

  const isDisabled = useMemo(() => {
    return !file;
  }, [file]);

  const processBill = async () => {
    if (!file) return;
    setIsLoading(true);
    localStorage.removeItem("billFormData");
    try {
      const uploadedBill = await uploadReceiptImage(file);

      const response = await fetch("/api/vision", {
        method: "POST",
        body: JSON.stringify({
          billUrl: uploadedBill.url,
          billKey: uploadedBill.key,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const extractedData = (await response.json()) as ExtractSchemaType;

      formObject.setValue(
        "businessName",
        extractedData.businessName ?? undefined,
      );
      extractedData.date &&
        formObject.setValue("date", new Date(extractedData.date));
      formObject.setValue(
        "billItems",
        (extractedData?.billItems || []).map((item) => {
          return {
            id: createId(),
            name: item.name,
            price: new Decimal(item.price),
            assignedTo: [],
          };
        })
      );
      formObject.setValue("tax", new Decimal(extractedData?.tax || 0));
      formObject.setValue("tip", new Decimal(extractedData?.tip || 0));

      goForward();
    } catch (e) {
      // toast error couldn't process bill visually
      console.error("Error processing bill:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isManual) {
    return (
      <>
        <SubPageHeader
          title="Manual Entry"
          description="Take a photo or upload an image of your receipt"
          onBack={goBack}
        />

        <form className="w-full space-y-6">
          <div>
            <label
              htmlFor="restaurant-name"
              className="block text-sm font-medium text-left text-[#4a5565] mb-1"
            >
              Restaurant Name (optional):
            </label>
            <input
              type="text"
              id="restaurant-name"
              placeholder="e.g. Olive Garden"
              className="w-full px-3 py-2.5 rounded-lg border border-[#d1d5dc] bg-white focus:outline-none focus:ring-2 focus:ring-[#d04f17] focus:border-transparent"
              {...register("businessName")}
            />
          </div>
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-left text-[#4a5565] mb-1"
            >
              Date (optional):
            </label>
            <DatePicker
              date={watch("date")}
              onDateChange={(date) => {
                register("date").onChange({
                  target: { value: date, name: "date" },
                });
              }}
            />
          </div>
        </form>
        <Button className="w-full" onClick={goForward}>
          <span>Continue</span>
        </Button>
      </>
    );
  }

  return (
    <>
      <SubPageHeader
        title="Scan Receipt"
        description="Take a photo or upload  an image of your receipt"
        onBack={goBack}
      />

      <Dropzone
        multiple={false}
        accept={{
          "image/*": [".jpg", ".jpeg", ".png"],
        }}
        onDrop={(acceptedFiles) => {
          if (isLoading) return;
          const file = acceptedFiles[0];
          if (file.size > MAX_RECEIPT_UPLOAD_BYTES) {
            // toast({
            //   title: "📁 File Too Large",
            //   description: "⚠️ File size must be less than 15MB",
            // });
            return;
          }
          setFile(file);
        }}
      >
        {({ getRootProps, getInputProps }) => (
          <div
            className="flex flex-col justify-start items-start max-w-[350px] w-full max-h-[479px] h-full relative overflow-hidden gap-2.5 p-4 rounded-2xl bg-[#faf7f5] border border-gray-200"
            style={{ boxShadow: "0px 1px 6px -4px rgba(0,0,0,0.2)" }}
            {...getRootProps()}
          >
            <div className="h-[447px] w-full relative overflow-hidden rounded-xl bg-[#f6f0ed] border border-[#d1d5dc] border-dashed flex justify-center items-center">
              {file ? (
                <div className="w-full h-full relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Receipt preview"
                    className="w-full h-full object-contain p-4"
                  />
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/10">
                      <div className="absolute inset-x-0 h-1 bg-orange-500/50 animate-scan-line" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/90 px-4 py-2 rounded-lg flex items-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full" />
                          <span className="text-sm font-medium animate-pulse">
                            {
                              [
                                "Looking at receipt...",
                                "Transcribing items...",
                                "Checking tax and tips...",
                              ][Math.floor((Date.now() / 2000) % 3)]
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {!isLoading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white/90 transition-colors"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <img
                    className="w-[131px] h-[72px]"
                    src="/camera.png"
                    alt="Camera icon"
                  />
                  <div className="flex flex-col">
                    <p className="text-base font-medium text-center text-[#364153]">
                      Take a photo
                    </p>
                    <input required={!file} {...getInputProps()} />
                    <div className="text-xs text-center underline text-[#4a5565] cursor-pointer">
                      or upload receipt
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Dropzone>
      <Button
        className="w-full mt-6 min-h-[46px]"
        onClick={processBill}
        disabled={isDisabled || isLoading}
      >
        <span className="flex items-center justify-center gap-2">
          {isLoading && (
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          )}
          {!isLoading && <span>Scrape the Bill</span>}
        </span>
      </Button>
    </>
  );
};
